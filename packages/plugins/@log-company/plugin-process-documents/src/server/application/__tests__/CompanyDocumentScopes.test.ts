/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { DocumentScopeService } from '../DocumentScopeService';
import { ListProcessDocuments } from '../ListProcessDocuments';
import { documentStorageOwnerPath } from '../documentStorageOwnerPath';
import { ProcessDocumentsError } from '../../domain/documents/DocumentErrors';
import type {
  DocumentActor,
  DocumentFolderRecord,
  ProcessDocumentsRepository,
} from '../ports/ProcessDocumentsRepository';

const actor: DocumentActor = { isRoot: false, userId: '7', roles: ['manager'], authorizationContext: {} };
const run = { mode: 'run' as const, runId: '87' };
const request = { shipmentId: null, draftToken: null, actor, companyId: '10', runId: '87' };

function folder(id: string, overrides: Partial<DocumentFolderRecord> = {}): DocumentFolderRecord {
  return {
    id,
    title: `Папка ${id}`,
    companyId: null,
    runId: '87',
    shipmentId: null,
    draftToken: null,
    parentFolderId: null,
    createdById: '1',
    ...overrides,
  };
}

function fixture(rows: DocumentFolderRecord[] = []) {
  const assertCompanyAccess = vi.fn(async () => undefined);
  const assertRunAccess = vi.fn(async () => undefined);
  const assertAccess = vi.fn(async () => undefined);
  const listDocuments = vi.fn(async () => []);
  const repository = {
    findFolderById: vi.fn(async (id: string) => rows.find((row) => row.id === id) ?? null),
    listFolders: vi.fn(async () => rows.filter((row) => !row.parentFolderId)),
    listDocuments,
  } as unknown as ProcessDocumentsRepository;
  const scopes = new DocumentScopeService(repository, { assertAccess, assertCompanyAccess, assertRunAccess });
  return {
    scopes,
    assertCompanyAccess,
    assertRunAccess,
    listDocuments,
    list: new ListProcessDocuments(repository, scopes),
  };
}

describe('Company and run document scopes', () => {
  it('uses the same run owner from the card and both linked companies', async () => {
    const { scopes, list, listDocuments, assertRunAccess } = fixture([folder('30')]);
    await list.execute({ ...request, folderId: null });
    await list.execute({ ...request, companyId: '11', folderId: null });
    await list.execute({ ...request, companyId: null, folderId: null });
    expect(listDocuments.mock.calls).toEqual([
      [run, null],
      [run, null],
      [run, null],
    ]);
    expect(assertRunAccess).toHaveBeenCalledWith('87', 'read', actor, '10');
    expect(assertRunAccess).toHaveBeenCalledWith('87', 'read', actor, '11');
    expect(assertRunAccess).toHaveBeenCalledWith('87', 'read', actor, null);
    await expect(scopes.resolveForFolder(folder('30'), null, 'write', actor)).resolves.toEqual(run);
    expect(documentStorageOwnerPath(run)).toBe('runs/87');
  });

  it('rejects an ambiguous owner', async () => {
    const { scopes, assertRunAccess } = fixture();
    await expect(scopes.resolve({ ...request, shipmentId: '1042', operation: 'read' })).rejects.toMatchObject({
      code: 'INVALID_DOCUMENT_SCOPE',
    });
    expect(assertRunAccess).not.toHaveBeenCalled();
  });

  it('rejects folders belonging to a different run, a shipment or a company', async () => {
    const { list, listDocuments } = fixture([
      folder('30', { runId: '88' }),
      folder('31', { runId: null, shipmentId: '1042' }),
      folder('32', { runId: null, companyId: '10' }),
    ]);
    for (const folderId of ['30', '31', '32']) {
      await expect(list.execute({ ...request, folderId })).rejects.toMatchObject({ code: 'CROSS_SCOPE_FOLDER' });
    }
    expect(listDocuments).not.toHaveBeenCalled();
  });

  it('hides restricted folders and checks their grants when a child is requested directly', async () => {
    const restricted = folder('30', { grants: [{ kind: 'role', subject: 'declarant', level: 'read' }] });
    const child = folder('31', { parentFolderId: '30', grants: [{ kind: 'user', subject: '7', level: 'delete' }] });
    const { list } = fixture([restricted, child, folder('32')]);
    const root = await list.execute({ ...request, folderId: null });
    expect(root.folders.map((item) => item.id)).toEqual(['32']);
    await expect(list.execute({ ...request, folderId: '31' })).rejects.toMatchObject({
      code: 'DOCUMENT_ACCESS_DENIED',
    });
  });

  it('allows an individual reader and omits mutation permissions inside a read-only folder', async () => {
    const { list } = fixture([folder('30', { grants: [{ kind: 'user', subject: '7', level: 'read' }] })]);
    const result = await list.execute({ ...request, folderId: '30' });
    expect(result.permissions).toEqual({ canRead: true, canWrite: false, canDelete: false, canManageAccess: false });
  });

  it('keeps source permissions even when a folder grants access', async () => {
    const { list, assertRunAccess } = fixture([folder('30')]);
    assertRunAccess.mockRejectedValue(new ProcessDocumentsError('DOCUMENT_ACCESS_DENIED', 'Недоступно'));
    await expect(list.execute({ ...request, folderId: '30' })).rejects.toMatchObject({
      code: 'DOCUMENT_ACCESS_DENIED',
    });
  });
});
