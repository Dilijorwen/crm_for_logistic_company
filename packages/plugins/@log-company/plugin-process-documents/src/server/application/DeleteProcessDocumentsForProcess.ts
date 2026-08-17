/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { ApplicationLogger, DocumentStorage } from './ports/DocumentStorage';
import type { ProcessDocumentsRepository, TransactionContext } from './ports/ProcessDocumentsRepository';

export interface DeleteProcessDocumentsForProcessInput {
  processId: string;
  transaction?: TransactionContext;
}

export class DeleteProcessDocumentsForProcess {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly storage: DocumentStorage,
    private readonly logger: ApplicationLogger,
  ) {}

  async execute(input: DeleteProcessDocumentsForProcessInput): Promise<void> {
    const documents = await this.repository.listDocumentsByProcessId(input.processId, input.transaction);
    let processPrefixKeys: string[];
    try {
      processPrefixKeys = await this.storage.listKeys(`processes/${input.processId}/`);
    } catch (error) {
      this.logger.error('Не удалось получить список объектов удаляемого процесса в хранилище', error, {
        processId: input.processId,
      });
      throw error;
    }
    await this.repository.deleteDocumentsByProcessId(input.processId, input.transaction);
    await this.repository.deleteFoldersByProcessId(input.processId, input.transaction);

    const storageKeys = new Map(documents.map((document) => [document.storageKey, document.id]));
    for (const storageKey of processPrefixKeys) {
      if (!storageKeys.has(storageKey)) {
        storageKeys.set(storageKey, null);
      }
    }

    const removeStorageObjects = async () => {
      for (const [storageKey, documentId] of storageKeys) {
        try {
          const deleted = await this.storage.delete(storageKey);
          if (!deleted) {
            this.logger.warn('Объект документа удалённого процесса уже отсутствовал в хранилище', {
              processId: input.processId,
              documentId,
              storageKey,
            });
          }
        } catch (error) {
          this.logger.error('После удаления процесса остался объект документа в хранилище', error, {
            processId: input.processId,
            documentId,
            storageKey,
          });
        }
      }
    };

    if (input.transaction?.afterCommit) {
      input.transaction.afterCommit(removeStorageObjects);
      return;
    }
    await removeStorageObjects();
  }
}
