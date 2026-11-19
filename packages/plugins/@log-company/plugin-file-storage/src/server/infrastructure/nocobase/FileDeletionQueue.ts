/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database, Transaction } from '@nocobase/database';
import { validateStorageKey } from '../../domain/StorageKey';
import type { FileStorageAreaName, FileStorageService } from '../FileStorageService';

interface PendingDeletion {
  id: string;
  area: FileStorageAreaName;
  object_key: string;
  current_only: boolean;
}

const pollIntervalMs = 5_000;

export class FileDeletionQueue {
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;

  constructor(
    private readonly database: Database,
    private readonly storage: FileStorageService,
    private readonly application: string,
    private readonly reportError: (message: string, name: string) => void,
  ) {}

  async enqueue(
    area: FileStorageAreaName,
    keys: readonly string[],
    options: { transaction?: Transaction; currentOnly?: boolean } = {},
  ): Promise<void> {
    if (!keys.length) return;
    await this.database.sequelize.query(
      `insert into log_company_file_deletions (application, area, object_key, current_only)
       select :application, :area, key, :currentOnly from jsonb_array_elements_text(cast(:keys as jsonb)) as entries(key)`,
      {
        replacements: {
          application: this.application,
          area,
          keys: JSON.stringify([...new Set(keys)].map(validateStorageKey)),
          currentOnly: options.currentOnly ?? false,
        },
        transaction: options.transaction,
      },
    );
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (this.running) return;
      this.running = this.flush()
        .catch((error: unknown) => {
          this.reportError(
            'Не удалось обработать очередь удаления файлов.',
            error instanceof Error ? error.name : 'UnknownError',
          );
        })
        .finally(() => {
          this.running = undefined;
        });
    }, pollIntervalMs);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    clearInterval(this.timer);
    this.timer = undefined;
    await this.running;
  }

  async flush(): Promise<void> {
    const [result] = await this.database.sequelize.query(
      `update log_company_file_deletions set retry_at = now() + interval '1 minute'
       where id in (
         select id from log_company_file_deletions where application = :application and retry_at <= now()
         order by retry_at, id limit 25 for update skip locked
       )
       returning id, area, object_key, current_only`,
      { replacements: { application: this.application } },
    );
    for (const job of result as PendingDeletion[]) {
      try {
        await this.storage.area(job.area).delete(job.object_key, job.current_only);
      } catch (error) {
        this.reportError('Удаление файла будет повторено.', error instanceof Error ? error.name : 'UnknownError');
        continue;
      }
      await this.database.sequelize.query('delete from log_company_file_deletions where id = :id', {
        replacements: { id: job.id },
      });
    }
  }
}
