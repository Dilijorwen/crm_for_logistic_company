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
import type { DocumentStorage } from '../ports/DocumentStorage';
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
  const enqueueDeletion = vi.fn().mockResolvedValue(undefined);
  const storage = { enqueueDeletion } as unknown as DocumentStorage;
  return {
    repository,
    scopeService,
    storage,
    transaction,
    deleteDocument,
    withTransaction,
    requireDocument,
    resolveForDocument,
    enqueueDeletion,
  };
}

describe('DeleteProcessDocument', () => {
  it('records the exact object key in the metadata deletion transaction', async () => {
    const deps = dependencies();
    const useCase = new DeleteProcessDocument(deps.repository, deps.scopeService, deps.storage);

    await useCase.execute({
      documentId: document.id,
      draftToken: null,
      actor: { userId: '7', isRoot: false, authorizationContext: {} },
    });

    expect(deps.deleteDocument).toHaveBeenCalledWith(document.id, deps.transaction);
    expect(deps.enqueueDeletion).toHaveBeenCalledWith([document.storageKey], deps.transaction);
    expect(deps.deleteDocument.mock.invocationCallOrder[0]).toBeLessThan(
      deps.enqueueDeletion.mock.invocationCallOrder[0],
    );
  });

  it('rejects unauthorized deletion before changing metadata or enqueuing cleanup', async () => {
    const deps = dependencies();
    const denied = new Error('Access denied');
    deps.resolveForDocument.mockRejectedValueOnce(denied);
    const useCase = new DeleteProcessDocument(deps.repository, deps.scopeService, deps.storage);

    await expect(
      useCase.execute({
        documentId: document.id,
        draftToken: null,
        actor: { userId: '7', isRoot: false, authorizationContext: {} },
      }),
    ).rejects.toThrow(denied);

    expect(deps.withTransaction).not.toHaveBeenCalled();
    expect(deps.enqueueDeletion).not.toHaveBeenCalled();
  });

  it('fails the metadata transaction when cleanup cannot be enqueued', async () => {
    const deps = dependencies();
    const storageError = new Error('Queue unavailable');
    deps.enqueueDeletion.mockRejectedValue(storageError);
    const useCase = new DeleteProcessDocument(deps.repository, deps.scopeService, deps.storage);

    await expect(
      useCase.execute({
        documentId: document.id,
        draftToken: null,
        actor: { userId: '7', isRoot: false, authorizationContext: {} },
      }),
    ).rejects.toThrow(storageError);
  });
});
