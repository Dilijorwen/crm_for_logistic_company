/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { DeleteProcessDocumentsForProcess } from '../DeleteProcessDocumentsForProcess';
import type { ApplicationLogger, DocumentStorage } from '../ports/DocumentStorage';
import type {
  ProcessDocumentRecord,
  ProcessDocumentsRepository,
  TransactionContext,
} from '../ports/ProcessDocumentsRepository';

function documentRecord(id: string, storageKey: string): ProcessDocumentRecord {
  return {
    id,
    title: `${id}.pdf`,
    originalFilename: `${id}.pdf`,
    shipmentId: 'shipment-1',
    draftToken: null,
    folderId: null,
    storageKey,
    mimeType: 'application/pdf',
    fileSize: 1,
    createdById: 'user-1',
  };
}

function dependencies(documents: ProcessDocumentRecord[]) {
  const listDocumentsByOwner = vi.fn().mockResolvedValue(documents);
  const deleteDocumentsByOwner = vi.fn().mockResolvedValue(undefined);
  const deleteFoldersByOwner = vi.fn().mockResolvedValue(undefined);
  const listKeys = vi.fn().mockResolvedValue([]);
  const enqueueDeletion = vi.fn().mockResolvedValue(undefined);
  const transaction: TransactionContext = {};
  const warn = vi.fn();
  const error = vi.fn();

  return {
    repository: {
      withTransaction: (work: (tx: TransactionContext) => Promise<unknown>) => work(transaction),
      listDocumentsByOwner,
      deleteDocumentsByOwner,
      deleteFoldersByOwner,
    } as unknown as ProcessDocumentsRepository,
    storage: { listKeys, enqueueDeletion } as unknown as DocumentStorage,
    logger: { warn, error } as ApplicationLogger,
    listDocumentsByOwner,
    deleteDocumentsByOwner,
    deleteFoldersByOwner,
    listKeys,
    enqueueDeletion,
    transaction,
    warn,
    error,
  };
}

describe('DeleteProcessDocumentsForProcess', () => {
  it('queues exact linked and shipment-prefixed keys in the shipment transaction', async () => {
    const firstDocument = documentRecord('document-1', 'shipments/drafts/token/document-1.pdf');
    const secondDocument = documentRecord('document-2', 'shipments/shipment-1/document-2.pdf');
    const deps = dependencies([firstDocument, secondDocument]);
    const unindexedStorageKey = 'shipments/shipment-1/unindexed-document.pdf';
    deps.listKeys.mockResolvedValue([
      secondDocument.storageKey,
      unindexedStorageKey,
      'shipments/shipment-10/other.pdf',
    ]);
    const transaction: TransactionContext = {};
    const useCase = new DeleteProcessDocumentsForProcess(deps.repository, deps.storage, deps.logger);

    await useCase.execute({ shipmentId: 'shipment-1', transaction });

    expect(deps.listDocumentsByOwner).toHaveBeenCalledWith({ mode: 'shipment', shipmentId: 'shipment-1' }, transaction);
    expect(deps.listKeys).toHaveBeenCalledWith('shipments/shipment-1/');
    expect(deps.deleteDocumentsByOwner).toHaveBeenCalledWith(
      { mode: 'shipment', shipmentId: 'shipment-1' },
      transaction,
    );
    expect(deps.deleteFoldersByOwner).toHaveBeenCalledWith({ mode: 'shipment', shipmentId: 'shipment-1' }, transaction);
    expect(deps.enqueueDeletion).toHaveBeenCalledWith(
      [firstDocument.storageKey, secondDocument.storageKey, unindexedStorageKey],
      transaction,
    );
  });

  it('queues only the deleted run’s files in the caller’s transaction', async () => {
    const document = documentRecord('document-1', 'runs/41/document-1.pdf');
    const deps = dependencies([document]);
    deps.listKeys.mockResolvedValue(['runs/41/unindexed.pdf', 'runs/410/other.pdf', 'shipments/41/other.pdf']);
    const useCase = new DeleteProcessDocumentsForProcess(deps.repository, deps.storage, deps.logger);

    await useCase.execute({ runId: '41', transaction: deps.transaction });

    expect(deps.deleteDocumentsByOwner).toHaveBeenCalledWith({ mode: 'run', runId: '41' }, deps.transaction);
    expect(deps.deleteFoldersByOwner).toHaveBeenCalledWith({ mode: 'run', runId: '41' }, deps.transaction);
    expect(deps.enqueueDeletion).toHaveBeenCalledWith([document.storageKey, 'runs/41/unindexed.pdf'], deps.transaction);
  });

  it('creates a transaction for cleanup when called without one', async () => {
    const document = documentRecord('document-1', 'shipments/shipment-1/document-1.pdf');
    const deps = dependencies([document]);
    const useCase = new DeleteProcessDocumentsForProcess(deps.repository, deps.storage, deps.logger);

    await useCase.execute({ shipmentId: 'shipment-1' });

    expect(deps.enqueueDeletion).toHaveBeenCalledWith([document.storageKey], deps.transaction);
  });

  it('does not schedule MinIO deletion when database cleanup fails', async () => {
    const document = documentRecord('document-1', 'shipments/shipment-1/document-1.pdf');
    const deps = dependencies([document]);
    const databaseError = new Error('Database cleanup failed');
    deps.deleteDocumentsByOwner.mockRejectedValue(databaseError);
    const transaction: TransactionContext = { afterCommit: vi.fn() };
    const useCase = new DeleteProcessDocumentsForProcess(deps.repository, deps.storage, deps.logger);

    await expect(useCase.execute({ shipmentId: 'shipment-1', transaction })).rejects.toThrow(databaseError);

    expect(transaction.afterCommit).not.toHaveBeenCalled();
    expect(deps.deleteFoldersByOwner).not.toHaveBeenCalled();
    expect(deps.enqueueDeletion).not.toHaveBeenCalled();
  });

  it('does not delete database records when the MinIO shipment prefix cannot be listed', async () => {
    const document = documentRecord('document-1', 'shipments/shipment-1/document-1.pdf');
    const deps = dependencies([document]);
    const storageError = new Error('MinIO list failed');
    deps.listKeys.mockRejectedValue(storageError);
    const useCase = new DeleteProcessDocumentsForProcess(deps.repository, deps.storage, deps.logger);

    await expect(useCase.execute({ shipmentId: 'shipment-1' })).rejects.toThrow(storageError);

    expect(deps.deleteDocumentsByOwner).not.toHaveBeenCalled();
    expect(deps.deleteFoldersByOwner).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledWith(
      'Не удалось получить список объектов удаляемой записи в хранилище',
      storageError,
      { mode: 'shipment', shipmentId: 'shipment-1' },
    );
  });
});
