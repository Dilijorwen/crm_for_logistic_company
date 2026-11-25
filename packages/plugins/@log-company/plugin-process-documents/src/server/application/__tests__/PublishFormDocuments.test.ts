/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import type { DocumentFolderService } from '../DocumentFolderService';
import { PublishFormDocuments } from '../PublishFormDocuments';
import type { ProcessDocumentsRepository } from '../ports/ProcessDocumentsRepository';
import type { UploadProcessDocuments } from '../UploadProcessDocuments';

const actor = { isRoot: false, userId: '1', authorizationContext: {} };
const files = [{ path: '/tmp/example', originalName: 'ВЭД/Инвойс.pdf', mimeType: 'application/pdf', size: 5 }];
const outer = { transaction: {}, onRollback: vi.fn() };
const companyScope = { mode: 'company', companyId: '10', companyArea: 'company' };

function setup(
  folders: { id: string; title: string }[] = [],
  companies = ['10'],
  children: { id: string; title: string }[] = [],
) {
  const owners = {
    lockCompany: vi.fn(),
    contractImporterIds: vi.fn(async () => companies),
    publishPermit: vi.fn(),
    publishContract: vi.fn(),
  };
  const upload = {
    execute: vi.fn(),
    assertDestination: vi.fn(async (_input: { folderId: string | null }) => companyScope),
  };
  const repository = { listFolders: vi.fn(async (_scope, parent) => (parent === '52' ? children : folders)) };
  const documents = { create: vi.fn(async (_scope, title) => ({ id: title === 'По запросу' ? 'new' : 'typed' })) };
  const publish = new PublishFormDocuments(
    owners,
    repository as unknown as ProcessDocumentsRepository,
    documents as unknown as DocumentFolderService,
    upload as unknown as UploadProcessDocuments,
  );
  return { publish, owners, upload, repository, documents };
}

describe('Назначение файлов при сохранении карточки', () => {
  it('привязывает файлы поставки и рейса к разным записям, без компании и без копий', async () => {
    const { publish, upload } = setup();
    await publish.execute({ resource: 'shipments', recordId: '1043', actor, files }, outer);
    await publish.execute({ resource: 'transport_runs', recordId: '99', actor, files }, outer);
    expect(upload.execute.mock.calls).toEqual([
      [{ shipmentId: '1043', draftToken: null, folderId: null, actor, files }, outer],
      [{ runId: '99', shipmentId: null, draftToken: null, folderId: null, actor, files }, outer],
    ]);
  });

  it('публикует разрешительные документы только как штатные вложения', async () => {
    const { publish, owners, upload } = setup();
    const permit = { resource: 'permit_documents' as const, recordId: '99', actor, files };
    await publish.execute(permit, outer);
    expect(owners.publishPermit).toHaveBeenCalledOnce();
    expect(owners.publishPermit).toHaveBeenCalledWith(permit, outer);
    expect(upload.execute).not.toHaveBeenCalled();
  });

  it('отправляет файлы и пустые папки в указанную папку поставки в общей транзакции', async () => {
    const { publish, upload } = setup();
    await publish.execute(
      { resource: 'shipments', recordId: '1043', actor, files, folderId: '55', emptyFolders: ['Архив'] },
      outer,
    );
    expect(upload.execute).toHaveBeenCalledWith(
      { shipmentId: '1043', draftToken: null, folderId: '55', actor, files, emptyFolders: ['Архив'] },
      outer,
    );
  });

  it('сохраняет основной документ как вложение конкретного контракта', async () => {
    const { publish, owners, upload, documents } = setup(
      [{ id: '52', title: 'По запросам' }],
      ['10'],
      [{ id: '53', title: 'Контракт' }],
    );
    await publish.execute({ resource: 'contracts', recordId: '40', actor, files }, outer);
    expect(owners.contractImporterIds).toHaveBeenCalledWith('40', outer.transaction);
    expect(owners.publishContract).toHaveBeenCalledWith({ resource: 'contracts', recordId: '40', actor, files }, outer);
    expect(upload.execute).not.toHaveBeenCalled();
    expect(documents.create).not.toHaveBeenCalled();
  });

  it('создаёт недостающую папку компании только внутри сохранения', async () => {
    const { publish, documents, upload } = setup([{ id: '54', title: 'Учредительные' }]);
    await publish.execute({ resource: 'our_companies', recordId: '10', actor, files }, outer);
    expect(documents.create).toHaveBeenCalledWith(companyScope, 'По запросу', null, actor, outer.transaction);
    expect(documents.create).toHaveBeenCalledWith(
      companyScope,
      'Учредительные документы',
      'new',
      actor,
      outer.transaction,
    );
    expect(upload.execute).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: '10', folderId: 'typed', files }),
      outer,
    );
  });

  it('проверяет право на родительскую папку до создания подпапки', async () => {
    const { publish, upload, documents } = setup([{ id: '52', title: 'По запросу' }]);
    upload.assertDestination.mockImplementation(async (destination) => {
      if (destination.folderId === '52') throw new Error('Нет доступа к папке.');
      return companyScope;
    });
    await expect(publish.execute({ resource: 'our_companies', recordId: '10', actor, files }, outer)).rejects.toThrow(
      'Нет доступа к папке.',
    );
    expect(documents.create).not.toHaveBeenCalled();
    expect(upload.execute).not.toHaveBeenCalled();
  });

  it('не пишет файлы, когда с контрактом связано несколько компаний или найдено несколько папок', async () => {
    const ambiguousContract = setup([], ['10', '11']);
    await expect(
      ambiguousContract.publish.execute({ resource: 'contracts', recordId: '40', actor, files }, outer),
    ).rejects.toThrow('у контракта должна быть указана одна компания');
    expect(ambiguousContract.upload.execute).not.toHaveBeenCalled();
    const ambiguousFolder = setup([
      { id: '1', title: 'По запросу' },
      { id: '2', title: 'По запросам' },
    ]);
    await expect(
      ambiguousFolder.publish.execute({ resource: 'our_companies', recordId: '10', actor, files }, outer),
    ).rejects.toThrow('несколько папок');
    expect(ambiguousFolder.upload.execute).not.toHaveBeenCalled();
  });
});
