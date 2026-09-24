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
  shipmentId: string;
  transaction?: TransactionContext;
}

export class DeleteProcessDocumentsForProcess {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly storage: DocumentStorage,
    private readonly logger: ApplicationLogger,
  ) {}

  async execute(input: DeleteProcessDocumentsForProcessInput): Promise<void> {
    const documents = await this.repository.listDocumentsByShipmentId(input.shipmentId, input.transaction);
    let shipmentPrefixKeys: string[];
    try {
      shipmentPrefixKeys = await this.storage.listKeys(`shipments/${input.shipmentId}/`);
    } catch (error) {
      this.logger.error('Не удалось получить список объектов удаляемой поставки в хранилище', error, {
        shipmentId: input.shipmentId,
      });
      throw error;
    }
    await this.repository.deleteDocumentsByShipmentId(input.shipmentId, input.transaction);
    await this.repository.deleteFoldersByShipmentId(input.shipmentId, input.transaction);

    const storageKeys = new Map(documents.map((document) => [document.storageKey, document.id]));
    for (const storageKey of shipmentPrefixKeys) {
      if (!storageKeys.has(storageKey)) {
        storageKeys.set(storageKey, null);
      }
    }

    const removeStorageObjects = async () => {
      for (const [storageKey, documentId] of storageKeys) {
        try {
          const deleted = await this.storage.delete(storageKey);
          if (!deleted) {
            this.logger.warn('Объект документа удалённой поставки уже отсутствовал в хранилище', {
              shipmentId: input.shipmentId,
              documentId,
              storageKey,
            });
          }
        } catch (error) {
          this.logger.error('После удаления поставки остался объект документа в хранилище', error, {
            shipmentId: input.shipmentId,
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
