/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { AttachDraftDocumentsToProcess } from '../AttachDraftDocumentsToProcess';
import { DeleteProcessDocumentsForProcess } from '../DeleteProcessDocumentsForProcess';
import { DocumentFolderService } from '../DocumentFolderService';
import { DocumentScopeService } from '../DocumentScopeService';
import { UploadProcessDocuments } from '../UploadProcessDocuments';
import type { DocumentStorage } from '../ports/DocumentStorage';
import type {
  CreateDocumentRecordInput,
  CreateFolderRecordInput,
  DocumentFolderRecord,
  DocumentActor,
  ProcessDocumentRecord,
  ProcessDocumentsRepository,
  TransactionContext,
} from '../ports/ProcessDocumentsRepository';

const actor: DocumentActor = { userId: 'user-1', isRoot: true, authorizationContext: null };

function dependencies() {
  const documents: ProcessDocumentRecord[] = [];
  const folders: DocumentFolderRecord[] = [];
  const storedKeys = new Set<string>();
  const createDocument = vi.fn(async (input: CreateDocumentRecordInput): Promise<ProcessDocumentRecord> => {
    const document: ProcessDocumentRecord = {
      id: input.id,
      title: input.title,
      originalFilename: input.originalFilename,
      shipmentId: input.scope.mode === 'shipment' ? input.scope.shipmentId : null,
      draftToken: input.scope.mode === 'draft' ? input.scope.draftToken : null,
      folderId: input.folderId,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      createdById: input.actorId,
    };
    documents.push(document);
    return document;
  });
  const repository = {
    withTransaction: async <T>(work: (transaction: TransactionContext) => Promise<T>) => work({}),
    shipmentExists: async () => true,
    listDocumentTitles: async () => [],
    listFolderTitles: async () => [],
    findFolderById: async (id: string) => folders.find((folder) => folder.id === id) ?? null,
    createFolder: async (input: CreateFolderRecordInput) => {
      const folder = {
        id: input.id,
        title: input.title,
        shipmentId: input.scope.mode === 'shipment' ? input.scope.shipmentId : null,
        draftToken: input.scope.mode === 'draft' ? input.scope.draftToken : null,
        parentFolderId: input.parentFolderId,
        createdById: input.actorId,
      };
      folders.push(folder);
      return folder;
    },
    createDocument,
    listDocumentsByShipmentId: async (shipmentId: string) => documents.filter((item) => item.shipmentId === shipmentId),
    deleteDocumentsByShipmentId: vi.fn(async () => undefined),
    deleteFoldersByShipmentId: vi.fn(async () => undefined),
    attachDraftToShipment: async (draftToken: string, shipmentId: string) => {
      for (const document of documents.filter((item) => item.draftToken === draftToken)) {
        document.shipmentId = shipmentId;
        document.draftToken = null;
      }
    },
  } as unknown as ProcessDocumentsRepository;
  const storage: DocumentStorage = {
    open: async () => undefined,
    store: async ({ key }) => {
      storedKeys.add(key);
    },
    listKeys: async (prefix) => [...storedKeys].filter((key) => key.startsWith(prefix)),
    delete: async (key) => storedKeys.delete(key),
    enqueueDeletion: async (keys) => {
      for (const key of keys) storedKeys.delete(key);
    },
  };
  const logger = { warn: vi.fn(), error: vi.fn() };
  let nextId = 0;
  const identifiers = { generate: () => `document-${++nextId}` };
  const scopeService = new DocumentScopeService(repository, { assertAccess: async () => undefined });
  const upload = new UploadProcessDocuments(
    repository,
    storage,
    { generate: (ownerPath, filename) => `${ownerPath}/generated-${filename}` },
    identifiers,
    scopeService,
    new DocumentFolderService(repository, scopeService, identifiers),
    logger,
  );
  return {
    repository,
    storedKeys,
    createDocument,
    upload,
    cleanup: new DeleteProcessDocumentsForProcess(repository, storage, logger),
  };
}

describe('document storage lifecycle', () => {
  it('сохраняет пустые папки и файлы перетаскивания в общей структуре', async () => {
    const deps = dependencies();
    const input = {
      shipmentId: 'shipment-1',
      draftToken: null,
      folderId: null,
      actor,
      files: [{ path: '/tmp/act.pdf', originalName: 'Сканы/Акт.pdf', mimeType: 'application/pdf', size: 10 }],
    };
    await expect(deps.upload.execute({ ...input, emptyFolders: ['Сканы/../Архив'] })).rejects.toMatchObject({
      code: 'INVALID_UPLOAD',
    });
    expect(deps.storedKeys.size).toBe(0);
    const result = await deps.upload.execute({ ...input, emptyFolders: ['Сканы/Архив'] });
    const [scans, archive] = result.folders;
    expect(scans).toMatchObject({ title: 'Сканы', parentFolderId: null });
    expect(archive).toMatchObject({ title: 'Архив', parentFolderId: scans.id });
    expect(result.files).toMatchObject([{ title: 'Акт.pdf', folderId: scans.id }]);
  });
  it.each([
    { shipmentId: 'shipment-1', draftToken: null, expectedKey: 'shipments/shipment-1/generated-invoice.pdf' },
    { shipmentId: null, draftToken: 'draft-1', expectedKey: 'shipments/drafts/draft-1/generated-invoice.pdf' },
  ])('cleans uploaded and orphan objects without crossing the $expectedKey namespace', async (scope) => {
    const deps = dependencies();
    const result = await deps.upload.execute({
      shipmentId: scope.shipmentId,
      draftToken: scope.draftToken,
      folderId: null,
      files: [{ path: '/tmp/invoice.pdf', originalName: 'invoice.pdf', mimeType: 'application/pdf', size: 10 }],
      actor,
    });

    expect(result.files[0].storageKey).toBe(scope.expectedKey);
    expect([...deps.storedKeys]).toEqual([scope.expectedKey]);
    if (scope.draftToken) {
      await new AttachDraftDocumentsToProcess(deps.repository).execute({
        draftToken: scope.draftToken,
        shipmentId: 'shipment-1',
        actorId: actor.userId,
        isRoot: actor.isRoot,
      });
      expect(result.files[0].storageKey).toBe(scope.expectedKey);
    }
    deps.storedKeys.add('shipments/shipment-1/orphan.pdf');
    deps.storedKeys.add('shipments/shipment-10/other.pdf');
    deps.storedKeys.add('shipments/drafts/draft-10/other.pdf');

    await deps.cleanup.execute({ shipmentId: 'shipment-1' });

    expect([...deps.storedKeys]).toEqual(['shipments/shipment-10/other.pdf', 'shipments/drafts/draft-10/other.pdf']);
  });

  it('removes an uploaded object when its database record cannot be created', async () => {
    const deps = dependencies();
    const failure = new Error('The database rejected the document');
    deps.createDocument.mockRejectedValueOnce(failure);

    await expect(
      deps.upload.execute({
        shipmentId: null,
        draftToken: 'draft-1',
        folderId: null,
        files: [{ path: '/tmp/invoice.pdf', originalName: 'invoice.pdf', mimeType: 'application/pdf', size: 10 }],
        actor,
      }),
    ).rejects.toThrow(failure);

    expect([...deps.storedKeys]).toEqual([]);
  });
});
