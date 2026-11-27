/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { documentStorageOwnerPath } from './documentStorageOwnerPath';
import type { DocumentScope } from '../domain/documents/DocumentScope';
import type { ApplicationLogger, DocumentStorage } from './ports/DocumentStorage';
import type { ProcessDocumentsRepository, TransactionContext } from './ports/ProcessDocumentsRepository';

type RemovalOwner = Extract<DocumentScope, { mode: 'shipment' | 'run' }>;
export type DeleteProcessDocumentsForProcessInput = (
  | { shipmentId: string; runId?: never }
  | { runId: string; shipmentId?: never }
) & { transaction?: TransactionContext };

export class DeleteProcessDocumentsForProcess {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly storage: DocumentStorage,
    private readonly logger: ApplicationLogger,
  ) {}

  async execute(input: DeleteProcessDocumentsForProcessInput): Promise<void> {
    const owner: RemovalOwner =
      input.runId !== undefined
        ? { mode: 'run', runId: input.runId }
        : { mode: 'shipment', shipmentId: input.shipmentId };
    if (input.transaction) return this.enqueueCleanup(owner, input.transaction);
    await this.repository.withTransaction((transaction) => this.enqueueCleanup(owner, transaction));
  }

  private async enqueueCleanup(owner: RemovalOwner, transaction: TransactionContext): Promise<void> {
    const documents = await this.repository.listDocumentsByOwner(owner, transaction);
    const prefix = `${documentStorageOwnerPath(owner)}/`;
    let shipmentPrefixKeys: string[];
    try {
      shipmentPrefixKeys = await this.storage.listKeys(prefix);
    } catch (error) {
      this.logger.error('Не удалось получить список объектов удаляемой записи в хранилище', error, owner);
      throw error;
    }
    await this.repository.deleteDocumentsByOwner(owner, transaction);
    await this.repository.deleteFoldersByOwner(owner, transaction);
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
