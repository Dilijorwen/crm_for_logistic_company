/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import type { Context, Next } from '@nocobase/actions';
import { Database } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentScopeService } from '../../../application/DocumentScopeService';
import { ProcessDocumentsError } from '../../../domain/documents/DocumentErrors';
import type { PublishFormDocuments } from '../../../application/PublishFormDocuments';
import { TemporaryDocumentDrafts } from '../../../infrastructure/storage/TemporaryDocumentDrafts';
import { FormDocumentDraftsController } from '../FormDocumentDraftsController';

describe('Сохранение записи с временными документами', () => {
  let db: Database;
  let root: string;
  let drafts: TemporaryDocumentDrafts;
  let save: (context: Context, next: Next) => Promise<void>;
  let stageMultipart: (context: Context, next: Next) => Promise<void>;
  const upload = { execute: vi.fn() };
  const scopes = { assertShipmentFormAccess: vi.fn(), assertRunFormAccess: vi.fn() };
  let shipmentPermissions: typeof stageMultipart;

  beforeEach(async () => {
    upload.execute.mockReset();
    scopes.assertShipmentFormAccess.mockReset();
    scopes.assertRunFormAccess.mockReset();
    db = new Database({ dialect: 'sqlite', storage: ':memory:', logging: false });
    db.collection({ name: 'shipments', fields: [{ name: 'title', type: 'string' }] });
    db.collection({
      name: 'transport_runs',
      fields: [{ type: 'belongsToMany', name: 'shipments', target: 'shipments', through: 'transport_run_shipments' }],
    });
    db.collection({ name: 'published_documents', fields: [{ name: 'title', type: 'string' }] });
    await db.sync();
    root = await mkdtemp(path.join(tmpdir(), 'form-documents-test-'));
    drafts = new TemporaryDocumentDrafts(root, () => undefined);
    const plugin = {
      db,
      app: {
        acl: { allow: vi.fn() },
        resourceManager: {
          define: ({
            actions,
          }: {
            actions: { stage: typeof stageMultipart; shipmentPermissions: typeof shipmentPermissions };
          }) => {
            stageMultipart = actions.stage;
            shipmentPermissions = actions.shipmentPermissions;
          },
          use: (handler: typeof save) => {
            save = handler;
          },
        },
      },
    } as unknown as Plugin;
    new FormDocumentDraftsController(
      plugin,
      drafts,
      upload as unknown as PublishFormDocuments,
      scopes as unknown as DocumentScopeService,
    ).register();
  });

  afterEach(async () => {
    await db.close();
    await rm(root, { recursive: true, force: true });
  });

  async function stage(recordId: string | null = null) {
    return drafts.stage('1', { resource: 'shipments', recordId }, async (directory) => {
      const file = path.join(directory, 'file');
      await writeFile(file, 'hello');
      return { files: [{ path: file, size: 5, originalName: 'Контракты/Договор.txt', mimeType: 'text/plain' }] };
    });
  }
  function context(token: string, id?: string): Context {
    return {
      state: { currentUser: { id: 1 }, currentRole: 'root' },
      action: {
        actionName: id ? 'update' : 'create',
        resourceName: 'shipments',
        params: { values: { title: 'Карточка' }, ...(id && { filterByTk: id }) },
      },
      get: (header: string) => (header === 'X-Log-Company-Form-Documents' ? token : ''),
      status: 200,
      throw(status: number, message: string) {
        throw Object.assign(new Error(message), { status });
      },
    } as unknown as Context;
  }

  it('скрывает папки и отклоняет загрузку до записи во временное хранилище при запрете ВЭД', async () => {
    scopes.assertShipmentFormAccess.mockRejectedValue(
      new ProcessDocumentsError('DOCUMENT_ACCESS_DENIED', 'Нет доступа'),
    );
    const request = {
      ...context(''),
      method: 'POST',
      query: { resource: 'shipments', companyId: '10' },
      can: () => true,
      state: { currentUser: { id: 1 }, currentRole: 'manager' },
    } as unknown as Context;

    await shipmentPermissions(request, vi.fn());
    expect(request.body).toEqual({ canRead: false, canWrite: false });
    expect(scopes.assertShipmentFormAccess).toHaveBeenCalledWith(
      null,
      '10',
      null,
      'read',
      expect.objectContaining({ roles: ['manager'], isRoot: false }),
    );
    await expect(stageMultipart(request, vi.fn())).rejects.toMatchObject({ status: 403 });
    expect(await readdir(root)).toEqual([]);
  });

  it('запрещает загрузку документов рейса до создания временных файлов', async () => {
    scopes.assertRunFormAccess.mockImplementation(async (_id, _folder, operation) => {
      if (operation === 'write') throw new ProcessDocumentsError('DOCUMENT_ACCESS_DENIED', 'Нет доступа');
    });
    const request = {
      ...context(''),
      method: 'POST',
      query: { resource: 'transport_runs' },
      can: ({ resource }: { resource: string }) => resource === 'transport_runs',
      state: { currentUser: { id: 1 }, currentRole: 'manager' },
    } as unknown as Context;

    await shipmentPermissions(request, vi.fn());
    expect(request.body).toEqual({ canRead: true, canWrite: false });
    await expect(stageMultipart(request, vi.fn())).rejects.toMatchObject({ status: 403 });
    expect(scopes.assertRunFormAccess).toHaveBeenLastCalledWith(
      null,
      null,
      'write',
      expect.objectContaining({ roles: ['manager'] }),
    );
    expect(await readdir(root)).toEqual([]);
  });

  it('сохраняет UTF-8 путь из 200 частей отдельно от заголовка файла', async () => {
    const boundary = 'document-draft-long-path';
    const filename = [...Array(199).fill('文'.repeat(200)), '表格.txt'].join('/');
    const body = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="filePaths"\r\n\r\n${JSON.stringify([filename])}\r\n` +
        `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="upload"\r\n` +
        `Content-Type: text/plain\r\n\r\nhello\r\n--${boundary}--\r\n`,
    );
    const req = Object.assign(new PassThrough(), {
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': String(body.length) },
    });
    req.end(body);
    const staged = {
      ...context(''),
      method: 'POST',
      req,
      query: { resource: 'shipments', recordId: '42' },
      request: { length: body.length },
      can: () => true,
    } as unknown as Context;
    await stageMultipart(staged, vi.fn());
    expect(staged.body).toEqual({ token: expect.any(String), files: [{ name: filename, size: 5 }] });
  });

  it('принимает multipart с пустой папкой без файлов и сохраняет её только в черновике', async () => {
    const boundary = 'document-draft-test';
    const body = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="emptyFolders"\r\n\r\n["Скан/Архив"]\r\n--${boundary}--\r\n`,
    );
    const req = Object.assign(new PassThrough(), {
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': String(body.length) },
    });
    req.end(body);
    const staged = {
      ...context(''),
      method: 'POST',
      req,
      query: { resource: 'shipments', recordId: '42', folderId: 'folder-55' },
      request: { length: body.length },
      can: () => true,
    } as unknown as Context;
    await stageMultipart(staged, vi.fn());
    expect(staged.body).toEqual({ token: expect.any(String), files: [], emptyFolders: ['Скан/Архив'] });
    expect(upload.execute).not.toHaveBeenCalled();
    const draft = drafts.acquire([staged.body.token], '1', { resource: 'shipments', recordId: '42' });
    expect(draft.destinations).toEqual([{ folderId: 'folder-55', files: [], emptyFolders: ['Скан/Архив'] }]);
    await draft.release();
  });

  it('привязывает черновики к своим новым поставкам при сохранении рейса', async () => {
    const first = await stage();
    const second = await stage();
    expect(upload.execute).not.toHaveBeenCalled();
    const request = context('');
    request.action.resourceName = 'transport_runs';
    request.action.params.values = {
      shipments: [
        { title: 'Первая', _workspaceShipmentDocuments: [first.token] },
        { title: 'Вторая', _workspaceShipmentDocuments: [second.token] },
      ],
    };

    await save(request, async () => {
      await db.getRepository('transport_runs').create({
        values: request.action.params.values,
        context: request,
        updateAssociationValues: ['shipments'],
      });
    });

    const shipments = await db.getRepository('shipments').find({ sort: ['id'] });
    expect(shipments).toHaveLength(2);
    expect(upload.execute.mock.calls.map(([input]) => input.recordId)).toEqual(
      shipments.map((row) => String(row.get('id'))),
    );
    expect(await readdir(root)).toEqual([]);
  });

  it('откатывает рейс и поставки при сбое публикации черновика', async () => {
    const first = await stage();
    const second = await stage();
    const request = context('');
    request.action.resourceName = 'transport_runs';
    request.action.params.values = {
      shipments: [
        { title: 'Первая', _workspaceShipmentDocuments: [first.token] },
        { title: 'Вторая', _workspaceShipmentDocuments: [second.token] },
      ],
    };
    upload.execute
      .mockImplementationOnce(async (_input, outer) => {
        await db
          .getRepository('published_documents')
          .create({ values: { title: 'Документ' }, transaction: outer.transaction });
      })
      .mockRejectedValueOnce(new ProcessDocumentsError('FORM_DRAFT_BUSY', 'Сбой публикации'));

    await expect(
      save(request, async () => {
        await db.getRepository('transport_runs').create({
          values: request.action.params.values,
          context: request,
          updateAssociationValues: ['shipments'],
        });
      }),
    ).rejects.toMatchObject({ status: 409 });

    for (const resource of ['transport_runs', 'shipments', 'published_documents']) {
      expect(await db.getRepository(resource).count()).toBe(0);
    }
    expect(await readdir(root)).toHaveLength(2);
  });

  it('публикует файлы при успешном создании и удаляет временную копию после commit', async () => {
    const batch = await stage();
    expect(upload.execute).not.toHaveBeenCalled();
    upload.execute.mockImplementation(async (input, { transaction }) => {
      await db.getRepository('published_documents').create({
        values: { title: input.files[0].originalName },
        transaction,
      });
    });
    const request = context(batch.token);
    await save(request, async () => {
      await db.getRepository('shipments').create({ values: { title: 'Карточка' }, context: request });
    });
    const shipment = await db.getRepository('shipments').findOne();
    expect(shipment).toBeTruthy();
    expect(upload.execute).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'shipments', recordId: String(shipment.get('id')) }),
      expect.anything(),
    );
    expect(await db.getRepository('published_documents').count()).toBe(1);
    expect(await readdir(root)).toEqual([]);
  });

  it('откатывает запись и файлы при сбое после публикации и сохраняет возможность повторить', async () => {
    const batch = await stage();
    const removeObject = vi.fn();
    upload.execute.mockImplementation(async (input, { transaction, onRollback }) => {
      await db
        .getRepository('published_documents')
        .create({ values: { title: input.files[0].originalName }, transaction });
      onRollback(removeObject);
    });
    const request = context(batch.token);
    await expect(
      save(request, async () => {
        db.once('shipments.afterSaveWithAssociations', () => {
          throw new Error('save failed');
        });
        await db.getRepository('shipments').create({ values: { title: 'Карточка' }, context: request });
      }),
    ).rejects.toThrow('save failed');
    expect(await db.getRepository('shipments').count()).toBe(0);
    expect(await db.getRepository('published_documents').count()).toBe(0);
    expect(removeObject).toHaveBeenCalledOnce();
    expect(await readdir(root)).toHaveLength(1);
    const retry = context(batch.token);
    await save(retry, async () => {
      await db.getRepository('shipments').create({ values: { title: 'Карточка' }, context: retry });
    });
    expect(await readdir(root)).toEqual([]);
  });

  it('блокирует преждевременное сохранение и не позволяет присоединить черновик к другой записи', async () => {
    const next = vi.fn();
    await expect(save(context('pending'), next)).rejects.toMatchObject({ status: 409 });
    const batch = await stage('10');
    await expect(save(context(batch.token, '11'), next)).rejects.toMatchObject({ status: 403 });
    expect(next).not.toHaveBeenCalled();
  });

  it('публикует черновик только при обновлении выбранной записи', async () => {
    const card = await db.getRepository('shipments').create({ values: { title: 'Исходная карточка' } });
    const id = String(card.get('id'));
    const batch = await stage(id);
    const folderBatch = await drafts.stage(
      '1',
      { resource: 'shipments', recordId: id },
      async () => ({ files: [], emptyFolders: ['Архив'] }),
      'folder-55',
    );
    const request = context(`${batch.token},${folderBatch.token}`, id);
    upload.execute.mockResolvedValue({});
    await save(request, async () => {
      await db.getRepository('shipments').update({ filterByTk: id, values: { title: 'Обновлено' }, context: request });
    });
    expect(upload.execute).toHaveBeenCalledTimes(2);
    const [[rootUpload, outer], [nestedUpload, nestedOuter]] = upload.execute.mock.calls;
    expect(rootUpload.folderId).toBeUndefined();
    expect(nestedUpload).toMatchObject({ folderId: 'folder-55', files: [], emptyFolders: ['Архив'] });
    expect(nestedOuter.transaction).toBe(outer.transaction);
    expect((await db.getRepository('shipments').findOne({ filterByTk: id })).get('title')).toBe('Обновлено');
    expect(await readdir(root)).toEqual([]);
  });
});
