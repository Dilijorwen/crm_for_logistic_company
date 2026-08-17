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
    processId: 'process-1',
    draftToken: null,
    folderId: null,
    storageKey,
    mimeType: 'application/pdf',
    fileSize: 1,
    createdById: 'user-1',
  };
}

function dependencies(documents: ProcessDocumentRecord[]) {
  const listDocumentsByProcessId = vi.fn().mockResolvedValue(documents);
  const deleteDocumentsByProcessId = vi.fn().mockResolvedValue(undefined);
  const deleteFoldersByProcessId = vi.fn().mockResolvedValue(undefined);
  const listKeys = vi.fn().mockResolvedValue([]);
  const storageDelete = vi.fn().mockResolvedValue(true);
  const warn = vi.fn();
  const error = vi.fn();

  return {
    repository: {
      listDocumentsByProcessId,
      deleteDocumentsByProcessId,
      deleteFoldersByProcessId,
    } as unknown as ProcessDocumentsRepository,
    storage: { listKeys, delete: storageDelete } as unknown as DocumentStorage,
    logger: { warn, error } as ApplicationLogger,
    listDocumentsByProcessId,
    deleteDocumentsByProcessId,
    deleteFoldersByProcessId,
    listKeys,
    storageDelete,
    warn,
    error,
  };
}

describe('DeleteProcessDocumentsForProcess', () => {
  it('deletes database records in the process transaction and MinIO objects after commit', async () => {
    const firstDocument = documentRecord('document-1', 'processes/drafts/token/document-1.pdf');
    const secondDocument = documentRecord('document-2', 'processes/process-1/document-2.pdf');
    const deps = dependencies([firstDocument, secondDocument]);
    const unindexedStorageKey = 'processes/process-1/unindexed-document.pdf';
    deps.listKeys.mockResolvedValue([secondDocument.storageKey, unindexedStorageKey]);
    let afterCommitCallback: (() => void | Promise<void>) | undefined;
    const transaction: TransactionContext = {
      afterCommit: vi.fn((callback) => {
        afterCommitCallback = callback;
      }),
    };
    const useCase = new DeleteProcessDocumentsForProcess(deps.repository, deps.storage, deps.logger);

    await useCase.execute({ processId: 'process-1', transaction });

    expect(deps.listDocumentsByProcessId).toHaveBeenCalledWith('process-1', transaction);
    expect(deps.listKeys).toHaveBeenCalledWith('processes/process-1/');
    expect(deps.deleteDocumentsByProcessId).toHaveBeenCalledWith('process-1', transaction);
    expect(deps.deleteFoldersByProcessId).toHaveBeenCalledWith('process-1', transaction);
    expect(deps.storageDelete).not.toHaveBeenCalled();
    expect(afterCommitCallback).toBeDefined();

    await afterCommitCallback?.();

    expect(deps.storageDelete).toHaveBeenNthCalledWith(1, firstDocument.storageKey);
    expect(deps.storageDelete).toHaveBeenNthCalledWith(2, secondDocument.storageKey);
    expect(deps.storageDelete).toHaveBeenNthCalledWith(3, unindexedStorageKey);
  });

  it('deletes MinIO objects immediately when the process deletion has no transaction', async () => {
    const document = documentRecord('document-1', 'processes/process-1/document-1.pdf');
    const deps = dependencies([document]);
    const useCase = new DeleteProcessDocumentsForProcess(deps.repository, deps.storage, deps.logger);

    await useCase.execute({ processId: 'process-1' });

    expect(deps.storageDelete).toHaveBeenCalledWith(document.storageKey);
  });

  it('treats an already absent MinIO object as successfully removed', async () => {
    const document = documentRecord('document-1', 'processes/process-1/document-1.pdf');
    const deps = dependencies([document]);
    deps.storageDelete.mockResolvedValue(false);
    const useCase = new DeleteProcessDocumentsForProcess(deps.repository, deps.storage, deps.logger);

    await useCase.execute({ processId: 'process-1' });

    expect(deps.warn).toHaveBeenCalledWith(
      'Объект документа удалённого процесса уже отсутствовал в хранилище',
      expect.objectContaining({ processId: 'process-1', documentId: document.id }),
    );
  });

  it('logs a MinIO failure without interrupting cleanup of the remaining objects', async () => {
    const firstDocument = documentRecord('document-1', 'processes/process-1/document-1.pdf');
    const secondDocument = documentRecord('document-2', 'processes/process-1/document-2.pdf');
    const deps = dependencies([firstDocument, secondDocument]);
    const storageError = new Error('MinIO is unavailable');
    deps.storageDelete.mockRejectedValueOnce(storageError).mockResolvedValueOnce(true);
    const useCase = new DeleteProcessDocumentsForProcess(deps.repository, deps.storage, deps.logger);

    await useCase.execute({ processId: 'process-1' });

    expect(deps.error).toHaveBeenCalledWith(
      'После удаления процесса остался объект документа в хранилище',
      storageError,
      expect.objectContaining({ processId: 'process-1', documentId: firstDocument.id }),
    );
    expect(deps.storageDelete).toHaveBeenCalledWith(secondDocument.storageKey);
  });

  it('does not schedule MinIO deletion when database cleanup fails', async () => {
    const document = documentRecord('document-1', 'processes/process-1/document-1.pdf');
    const deps = dependencies([document]);
    const databaseError = new Error('Database cleanup failed');
    deps.deleteDocumentsByProcessId.mockRejectedValue(databaseError);
    const transaction: TransactionContext = { afterCommit: vi.fn() };
    const useCase = new DeleteProcessDocumentsForProcess(deps.repository, deps.storage, deps.logger);

    await expect(useCase.execute({ processId: 'process-1', transaction })).rejects.toThrow(databaseError);

    expect(transaction.afterCommit).not.toHaveBeenCalled();
    expect(deps.deleteFoldersByProcessId).not.toHaveBeenCalled();
    expect(deps.storageDelete).not.toHaveBeenCalled();
  });

  it('does not delete database records when the MinIO process prefix cannot be listed', async () => {
    const document = documentRecord('document-1', 'processes/process-1/document-1.pdf');
    const deps = dependencies([document]);
    const storageError = new Error('MinIO list failed');
    deps.listKeys.mockRejectedValue(storageError);
    const useCase = new DeleteProcessDocumentsForProcess(deps.repository, deps.storage, deps.logger);

    await expect(useCase.execute({ processId: 'process-1' })).rejects.toThrow(storageError);

    expect(deps.deleteDocumentsByProcessId).not.toHaveBeenCalled();
    expect(deps.deleteFoldersByProcessId).not.toHaveBeenCalled();
    expect(deps.error).toHaveBeenCalledWith(
      'Не удалось получить список объектов удаляемого процесса в хранилище',
      storageError,
      { processId: 'process-1' },
    );
  });
});
