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
import { DeleteProcessDocument } from '../DeleteProcessDocument';
import type { ApplicationLogger, DocumentStorage } from '../ports/DocumentStorage';
import type {
  ProcessDocumentRecord,
  ProcessDocumentsRepository,
  TransactionContext,
} from '../ports/ProcessDocumentsRepository';

const document: ProcessDocumentRecord = {
  id: '101',
  title: 'invoice.pdf',
  originalFilename: 'invoice.pdf',
  shipmentId: '202',
  draftToken: null,
  folderId: null,
  storageKey: 'shipments/202/invoice.pdf',
  mimeType: 'application/pdf',
  fileSize: 128,
  createdById: '7',
};

function dependencies() {
  const transaction: TransactionContext = {};
  const deleteDocument = vi.fn().mockResolvedValue(undefined);
  const withTransaction = vi.fn(async <T>(work: (currentTransaction: TransactionContext) => Promise<T>) =>
    work(transaction),
  );
  const repository = { withTransaction, deleteDocument } as unknown as ProcessDocumentsRepository;
  const requireDocument = vi.fn().mockResolvedValue(document);
  const resolveForDocument = vi.fn().mockResolvedValue({ mode: 'shipment', shipmentId: '202' });
  const scopeService = { requireDocument, resolveForDocument } as unknown as DocumentScopeService;
  const storageDelete = vi.fn().mockResolvedValue(true);
  const storage = { delete: storageDelete } as unknown as DocumentStorage;
  const logger: ApplicationLogger = {
    warn: vi.fn(),
    error: vi.fn(),
  };
  return {
    repository,
    scopeService,
    storage,
    logger,
    transaction,
    deleteDocument,
    withTransaction,
    requireDocument,
    resolveForDocument,
    storageDelete,
  };
}

describe('DeleteProcessDocument', () => {
  it('deletes the metadata and then the MinIO object', async () => {
    const deps = dependencies();
    const useCase = new DeleteProcessDocument(deps.repository, deps.scopeService, deps.storage, deps.logger);

    await useCase.execute({
      documentId: document.id,
      draftToken: null,
      actor: { userId: '7', isRoot: false, authorizationContext: {} },
    });

    expect(deps.deleteDocument).toHaveBeenCalledWith(document.id, deps.transaction);
    expect(deps.storageDelete).toHaveBeenCalledWith(document.storageKey);
    expect(deps.deleteDocument.mock.invocationCallOrder[0]).toBeLessThan(
      deps.storageDelete.mock.invocationCallOrder[0],
    );
  });

  it('treats an already absent MinIO object as a successful cleanup', async () => {
    const deps = dependencies();
    deps.storageDelete.mockResolvedValue(false);
    const useCase = new DeleteProcessDocument(deps.repository, deps.scopeService, deps.storage, deps.logger);

    await useCase.execute({
      documentId: document.id,
      draftToken: null,
      actor: { userId: '7', isRoot: false, authorizationContext: {} },
    });

    expect(deps.logger.warn).toHaveBeenCalledWith('Объект удалённого документа уже отсутствовал в хранилище', {
      storageKey: document.storageKey,
    });
  });

  it('logs a MinIO failure after the metadata transaction', async () => {
    const deps = dependencies();
    const storageError = new Error('MinIO unavailable');
    deps.storageDelete.mockRejectedValue(storageError);
    const useCase = new DeleteProcessDocument(deps.repository, deps.scopeService, deps.storage, deps.logger);

    await useCase.execute({
      documentId: document.id,
      draftToken: null,
      actor: { userId: '7', isRoot: false, authorizationContext: {} },
    });

    expect(deps.logger.error).toHaveBeenCalledWith(
      'После удаления документа остался объект в хранилище',
      storageError,
      { documentId: document.id, storageKey: document.storageKey },
    );
  });
});
