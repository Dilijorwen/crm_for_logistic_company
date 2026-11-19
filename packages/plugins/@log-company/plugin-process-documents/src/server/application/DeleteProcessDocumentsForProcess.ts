/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { documentStorageOwnerPath } from './documentStorageOwnerPath';
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
    if (input.transaction) return this.enqueueCleanup(input.shipmentId, input.transaction);
    await this.repository.withTransaction((transaction) => this.enqueueCleanup(input.shipmentId, transaction));
  }

  private async enqueueCleanup(shipmentId: string, transaction: TransactionContext): Promise<void> {
    const documents = await this.repository.listDocumentsByShipmentId(shipmentId, transaction);
    const prefix = `${documentStorageOwnerPath({ mode: 'shipment', shipmentId })}/`;
    let shipmentPrefixKeys: string[];
    try {
      shipmentPrefixKeys = await this.storage.listKeys(prefix);
    } catch (error) {
      this.logger.error('Не удалось получить список объектов удаляемой поставки в хранилище', error, {
        shipmentId,
      });
      throw error;
    }
    await this.repository.deleteDocumentsByShipmentId(shipmentId, transaction);
    await this.repository.deleteFoldersByShipmentId(shipmentId, transaction);
    await this.storage.enqueueDeletion(
      [
        ...new Set([
          ...documents.map((document) => document.storageKey),
          ...shipmentPrefixKeys.filter((key) => key.startsWith(prefix)),
        ]),
      ],
      transaction,
    );
  }
}
