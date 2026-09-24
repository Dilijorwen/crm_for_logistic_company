/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { PermitDocumentRepository } from './ports/PermitDocumentRepository';
import type { PermitDocumentSyncMode, PermitDocumentSyncQueue } from './ports/PermitDocumentSyncQueue';
import type { SyncClock, SyncLogger } from './ports/PermitDocumentSyncSupport';

const MAXIMUM_SCHEDULED_DOCUMENTS = 10_000;

export class SchedulePermitDocumentSync {
  constructor(
    private readonly repository: PermitDocumentRepository,
    private readonly queue: PermitDocumentSyncQueue,
    private readonly clock: SyncClock,
    private readonly logger: SyncLogger,
  ) {}

  async enqueueDailyDue(): Promise<number> {
    const checkedBefore = this.clock.now();
    const fullSyncIds = await this.repository.listDailyFullSyncDueIds(checkedBefore, MAXIMUM_SCHEDULED_DOCUMENTS);
    const remainingLimit = Math.max(0, MAXIMUM_SCHEDULED_DOCUMENTS - fullSyncIds.length);
    const statusCheckIds = await this.repository.listDailyStatusCheckDueIds(checkedBefore, remainingLimit);
    const fullSyncCount = await this.enqueue(fullSyncIds, 'FULL');
    const statusCheckCount = await this.enqueue(statusCheckIds, 'STATUS_ONLY');
    return fullSyncCount + statusCheckCount;
  }

  async recoverPending(): Promise<number> {
    const ids = await this.repository.listPendingIds(MAXIMUM_SCHEDULED_DOCUMENTS);
    return this.enqueue(ids, 'FULL');
  }

  private async enqueue(ids: readonly string[], mode: PermitDocumentSyncMode): Promise<number> {
    let count = 0;
    for (const documentId of ids) {
      try {
        await this.queue.enqueue(documentId, mode);
        count += 1;
      } catch (error) {
        this.logger.error('Failed to enqueue permit document synchronization.', {
          documentId,
          mode,
          errorName: error instanceof Error ? error.name : 'UnknownError',
        });
      }
    }
    return count;
  }
}
