/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import type { PermitDocumentRepository } from '../ports/PermitDocumentRepository';
import type { PermitDocumentSyncQueue } from '../ports/PermitDocumentSyncQueue';
import type { SyncClock, SyncLogger } from '../ports/PermitDocumentSyncSupport';
import { SchedulePermitDocumentSync } from '../SchedulePermitDocumentSync';

describe('SchedulePermitDocumentSync', () => {
  it('selects everything due by the daily run and continues after a single queue error', async () => {
    const repository = {
      listDailyFullSyncDueIds: vi.fn().mockResolvedValue(['1']),
      listDailyStatusCheckDueIds: vi.fn().mockResolvedValue(['2']),
    } as unknown as PermitDocumentRepository;
    const queue = {
      enqueue: vi.fn().mockRejectedValueOnce(new Error('queue')).mockResolvedValueOnce(undefined),
    } as PermitDocumentSyncQueue;
    const clock = { now: () => new Date('2026-08-28T10:00:00Z') } as SyncClock;
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as SyncLogger;

    await expect(new SchedulePermitDocumentSync(repository, queue, clock, logger).enqueueDailyDue()).resolves.toBe(1);
    expect(repository.listDailyFullSyncDueIds).toHaveBeenCalledWith(new Date('2026-08-28T10:00:00Z'), 10_000);
    expect(repository.listDailyStatusCheckDueIds).toHaveBeenCalledWith(new Date('2026-08-28T10:00:00Z'), 9_999);
    expect(queue.enqueue).toHaveBeenCalledTimes(2);
    expect(queue.enqueue).toHaveBeenNthCalledWith(1, '1', 'FULL');
    expect(queue.enqueue).toHaveBeenNthCalledWith(2, '2', 'STATUS_ONLY');
    expect(logger.error).toHaveBeenCalled();
  });
});
