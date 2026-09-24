/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ProcessDocumentsError } from '../domain/documents/DocumentErrors';
import type { ProcessDocumentsRepository, TransactionContext } from './ports/ProcessDocumentsRepository';

export interface AttachDraftDocumentsToProcessInput {
  draftToken: string | null;
  shipmentId: string | null;
  actorId: string | null;
  isRoot: boolean;
  transaction?: TransactionContext;
}

export class AttachDraftDocumentsToProcess {
  constructor(private readonly repository: ProcessDocumentsRepository) {}

  async execute(input: AttachDraftDocumentsToProcessInput): Promise<void> {
    if (!input.draftToken || !input.shipmentId) {
      return;
    }
    if (
      !input.isRoot &&
      (!input.actorId || (await this.repository.draftHasRecordsOwnedByOther(input.draftToken, input.actorId)))
    ) {
      throw new ProcessDocumentsError('DRAFT_ACCESS_DENIED', 'Нет прав для переноса черновых документов в поставку.');
    }
    await this.repository.attachDraftToShipment(input.draftToken, input.shipmentId, input.transaction);
  }
}
