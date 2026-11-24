/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import type { DocumentScopeService } from '../DocumentScopeService';
import type { ProcessDocumentsRepository } from '../ports/ProcessDocumentsRepository';
import { RenameProcessDocumentEntry } from '../RenameProcessDocumentEntry';

const actor = { userId: '23', isRoot: false, authorizationContext: {} };
const scope = { mode: 'company', companyId: '10', companyArea: 'company' } as const;
const transaction = {};

function setup() {
  const repository = {
    withTransaction: (work: (transaction: object) => Promise<void>) => work(transaction),
    listDocumentTitles: vi.fn(async () => ['Акт.pdf', 'Занято.pdf']),
    listFolderTitles: vi.fn(async () => ['Копии']),
    renameEntry: vi.fn(),
  };
  const scopes = {
    requireDocument: vi.fn(async () => ({ id: '1', title: 'Акт.pdf', originalFilename: 'Акт.pdf', folderId: '4' })),
    requireFolderById: vi.fn(async () => ({ id: '4', title: 'Копии', parentFolderId: '2' })),
    requireFolder: vi.fn(async () => ({ id: '2', title: 'По запросу' })),
    resolveForDocument: vi.fn(async () => scope),
    resolveForFolder: vi.fn(async () => scope),
  };
  const rename = new RenameProcessDocumentEntry(
    repository as unknown as ProcessDocumentsRepository,
    scopes as unknown as DocumentScopeService,
  );
  return { rename, repository, scopes };
}

describe('Переименование в файловом менеджере', () => {
  it('проверяет право переименования и записывает новое имя с исходным расширением', async () => {
    const { rename, repository, scopes } = setup();
    await rename.execute({ kind: 'file', id: '1', title: 'Акт подписанный', actor, draftToken: null });
    expect(scopes.resolveForDocument).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }), null, 'rename', actor);
    expect(repository.renameEntry).toHaveBeenCalledWith('file', '1', 'Акт подписанный.pdf', transaction);
  });

  it('переименовывает пользовательскую папку по прежнему ID', async () => {
    const { rename, repository } = setup();
    await rename.execute({ kind: 'folder', id: '4', title: 'Скан-копии', actor, draftToken: null });
    expect(repository.renameEntry).toHaveBeenCalledWith('folder', '4', 'Скан-копии', transaction);
  });

  it('не пишет данные при запрете или конфликте', async () => {
    const { rename, repository, scopes } = setup();
    const request = { kind: 'file' as const, id: '1', actor, draftToken: null, title: 'Занято' };
    await expect(rename.execute(request)).rejects.toMatchObject({ code: 'DOCUMENT_NAME_CONFLICT' });
    scopes.resolveForDocument.mockRejectedValueOnce(new Error('Нет доступа'));
    await expect(rename.execute(request)).rejects.toThrow('Нет доступа');
    await expect(rename.execute({ ...request, title: '../x' })).rejects.toMatchObject({
      code: 'INVALID_DOCUMENT_NAME',
    });
    expect(repository.renameEntry).not.toHaveBeenCalled();
  });
});
