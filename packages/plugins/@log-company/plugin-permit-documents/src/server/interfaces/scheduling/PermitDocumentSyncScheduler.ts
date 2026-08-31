/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { CronJob } from 'cron';
import type { Plugin } from '@nocobase/server';
import { SchedulePermitDocumentSync } from '../../application/SchedulePermitDocumentSync';
import { SynchronizePermitDocument } from '../../application/SynchronizePermitDocument';
import type { SyncLogger } from '../../application/ports/PermitDocumentSyncSupport';
import {
  PERMIT_DOCUMENT_SYNC_CHANNEL,
  type PermitDocumentSyncMessage,
} from '../../infrastructure/nocobase/NocoBasePermitDocumentSyncQueue';

const SCHEDULE_TIME_ZONE = 'Asia/Vladivostok';

export class PermitDocumentSyncScheduler {
  private cronJob: CronJob | null = null;

  constructor(
    private readonly plugin: Plugin,
    private readonly synchronize: SynchronizePermitDocument,
    private readonly schedule: SchedulePermitDocumentSync,
    private readonly logger: SyncLogger,
  ) {}

  register(): void {
    this.plugin.app.eventQueue.subscribe(PERMIT_DOCUMENT_SYNC_CHANNEL, {
      concurrency: 3,
      idle: () => true,
      process: async (message: unknown) => {
        const documentId = this.documentIdFrom(message);
        if (!documentId) {
          this.logger.warn('Ignored malformed permit document synchronization message.');
          return;
        }
        await this.synchronize.execute(documentId);
      },
    });
    this.cronJob = this.plugin.app.cronJobManager.addJob({
      cronTime: '0 0 0 * * *',
      timeZone: SCHEDULE_TIME_ZONE,
      onTick: async () => {
        try {
          const count = await this.schedule.enqueueDailyDue();
          this.logger.info('Daily permit document synchronization scheduled.', { count });
        } catch (error) {
          this.logger.error('Daily permit document synchronization scheduling failed.', {
            errorName: error instanceof Error ? error.name : 'UnknownError',
          });
        }
      },
    });
    this.plugin.app.on('afterStart', this.recoverPending);
    this.plugin.app.on('beforeStop', this.unsubscribeQueue);
  }

  dispose(): void {
    this.unsubscribeQueue();
    if (this.cronJob) {
      this.plugin.app.cronJobManager.removeJob(this.cronJob);
      this.cronJob = null;
    }
    this.plugin.app.off('afterStart', this.recoverPending);
    this.plugin.app.off('beforeStop', this.unsubscribeQueue);
  }

  private readonly recoverPending = async (): Promise<void> => {
    try {
      const count = await this.schedule.recoverPending();
      this.logger.info('Pending permit document synchronizations recovered.', { count });
    } catch (error) {
      this.logger.error('Pending permit document synchronization recovery failed.', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  };

  private readonly unsubscribeQueue = (): void => {
    this.plugin.app.eventQueue.unsubscribe(PERMIT_DOCUMENT_SYNC_CHANNEL);
  };

  private documentIdFrom(message: unknown): string | null {
    if (message === null || typeof message !== 'object') {
      return null;
    }
    const documentId = (message as Partial<PermitDocumentSyncMessage>).documentId;
    return typeof documentId === 'string' && documentId.trim().length > 0 ? documentId : null;
  }
}
