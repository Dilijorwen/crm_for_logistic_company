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
  const listDocumentsByShipmentId = vi.fn().mockResolvedValue(documents);
  const deleteDocumentsByShipmentId = vi.fn().mockResolvedValue(undefined);
  const deleteFoldersByShipmentId = vi.fn().mockResolvedValue(undefined);
  const listKeys = vi.fn().mockResolvedValue([]);
  const storageDelete = vi.fn().mockResolvedValue(true);
  const warn = vi.fn();
  const error = vi.fn();

  return {
    repository: {
      listDocumentsByShipmentId,
      deleteDocumentsByShipmentId,
      deleteFoldersByShipmentId,
    } as unknown as ProcessDocumentsRepository,
    storage: { listKeys, delete: storageDelete } as unknown as DocumentStorage,
    logger: { warn, error } as ApplicationLogger,
    listDocumentsByShipmentId,
    deleteDocumentsByShipmentId,
    deleteFoldersByShipmentId,
    listKeys,
    storageDelete,
    warn,
    error,
  };
}

describe('DeleteProcessDocumentsForProcess', () => {
  it('deletes database records in the shipment transaction and MinIO objects after commit', async () => {
    const firstDocument = documentRecord('document-1', 'shipments/drafts/token/document-1.pdf');
    const secondDocument = documentRecord('document-2', 'shipments/shipment-1/document-2.pdf');
    const deps = dependencies([firstDocument, secondDocument]);
    const unindexedStorageKey = 'shipments/shipment-1/unindexed-document.pdf';
    deps.listKeys.mockResolvedValue([secondDocument.storageKey, unindexedStorageKey]);
    let afterCommitCallback: (() => void | Promise<void>) | undefined;
    const transaction: TransactionContext = {
      afterCommit: vi.fn((callback) => {
        afterCommitCallback = callback;
      }),
    };
    const useCase = new DeleteProcessDocumentsForProcess(deps.repository, deps.storage, deps.logger);

    await useCase.execute({ shipmentId: 'shipment-1', transaction });

    expect(deps.listDocumentsByShipmentId).toHaveBeenCalledWith('shipment-1', transaction);
    expect(deps.listKeys).toHaveBeenCalledWith('shipments/shipment-1/');
    expect(deps.deleteDocumentsByShipmentId).toHaveBeenCalledWith('shipment-1', transaction);
    expect(deps.deleteFoldersByShipmentId).toHaveBeenCalledWith('shipment-1', transaction);
    expect(deps.storageDelete).not.toHaveBeenCalled();
    expect(afterCommitCallback).toBeDefined();

    await afterCommitCallback?.();

    expect(deps.storageDelete).toHaveBeenNthCalledWith(1, firstDocument.storageKey);
    expect(deps.storageDelete).toHaveBeenNthCalledWith(2, secondDocument.storageKey);
    expect(deps.storageDelete).toHaveBeenNthCalledWith(3, unindexedStorageKey);
  });

  it('deletes MinIO objects immediately when the shipment deletion has no transaction', async () => {
    const document = documentRecord('document-1', 'shipments/shipment-1/document-1.pdf');
    const deps = dependencies([document]);
    const useCase = new DeleteProcessDocumentsForProcess(deps.repository, deps.storage, deps.logger);

    await useCase.execute({ shipmentId: 'shipment-1' });

    expect(deps.storageDelete).toHaveBeenCalledWith(document.storageKey);
  });

  it('treats an already absent MinIO object as successfully removed', async () => {
    const document = documentRecord('document-1', 'shipments/shipment-1/document-1.pdf');
    const deps = dependencies([document]);
    deps.storageDelete.mockResolvedValue(false);
    const useCase = new DeleteProcessDocumentsForProcess(deps.repository, deps.storage, deps.logger);

    await useCase.execute({ shipmentId: 'shipment-1' });

    expect(deps.warn).toHaveBeenCalledWith(
      'Объект документа удалённой поставки уже отсутствовал в хранилище',
      expect.objectContaining({ shipmentId: 'shipment-1', documentId: document.id }),
    );
  });

  it('logs a MinIO failure without interrupting cleanup of the remaining objects', async () => {
    const firstDocument = documentRecord('document-1', 'shipments/shipment-1/document-1.pdf');
    const secondDocument = documentRecord('document-2', 'shipments/shipment-1/document-2.pdf');
    const deps = dependencies([firstDocument, secondDocument]);
    const storageError = new Error('MinIO is unavailable');
    deps.storageDelete.mockRejectedValueOnce(storageError).mockResolvedValueOnce(true);
    const useCase = new DeleteProcessDocumentsForProcess(deps.repository, deps.storage, deps.logger);

    await useCase.execute({ shipmentId: 'shipment-1' });

    expect(deps.error).toHaveBeenCalledWith(
      'После удаления поставки остался объект документа в хранилище',
      storageError,
      expect.objectContaining({ shipmentId: 'shipment-1', documentId: firstDocument.id }),
    );
    expect(deps.storageDelete).toHaveBeenCalledWith(secondDocument.storageKey);
  });

  it('does not schedule MinIO deletion when database cleanup fails', async () => {
    const document = documentRecord('document-1', 'shipments/shipment-1/document-1.pdf');
    const deps = dependencies([document]);
    const databaseError = new Error('Database cleanup failed');
    deps.deleteDocumentsByShipmentId.mockRejectedValue(databaseError);
    const transaction: TransactionContext = { afterCommit: vi.fn() };
    const useCase = new DeleteProcessDocumentsForProcess(deps.repository, deps.storage, deps.logger);

    await expect(useCase.execute({ shipmentId: 'shipment-1', transaction })).rejects.toThrow(databaseError);

    expect(transaction.afterCommit).not.toHaveBeenCalled();
    expect(deps.deleteFoldersByShipmentId).not.toHaveBeenCalled();
    expect(deps.storageDelete).not.toHaveBeenCalled();
  });

  it('does not delete database records when the MinIO shipment prefix cannot be listed', async () => {
    const document = documentRecord('document-1', 'shipments/shipment-1/document-1.pdf');
    const deps = dependencies([document]);
    const storageError = new Error('MinIO list failed');
    deps.listKeys.mockRejectedValue(storageError);
    const useCase = new DeleteProcessDocumentsForProcess(deps.repository, deps.storage, deps.logger);

    await expect(useCase.execute({ shipmentId: 'shipment-1' })).rejects.toThrow(storageError);

    expect(deps.deleteDocumentsByShipmentId).not.toHaveBeenCalled();
    expect(deps.deleteFoldersByShipmentId).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledWith(
      'Не удалось получить список объектов удаляемой поставки в хранилище',
      storageError,
      { shipmentId: 'shipment-1' },
    );
  });
});
