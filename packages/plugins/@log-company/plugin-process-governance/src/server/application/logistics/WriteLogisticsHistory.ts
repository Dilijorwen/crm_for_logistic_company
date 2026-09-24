/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { LogisticsHistoryEntry } from '../../domain/logistics/LogisticsHistory';
import type { LogisticsLogger, LogisticsRepository, LogisticsTransaction } from './ports/LogisticsRepository';

export interface WriteLogisticsHistoryInput {
  entry: LogisticsHistoryEntry;
  transaction?: LogisticsTransaction;
  context?: unknown;
}

export class WriteLogisticsHistory {
  constructor(
    private readonly repository: LogisticsRepository,
    private readonly logger: LogisticsLogger,
  ) {}

  async execute(input: WriteLogisticsHistoryInput): Promise<void> {
    if (!this.repository.historyCollectionExists(input.entry.entityKind)) {
      this.logger.warn('Коллекция истории недоступна, событие пропущено', {
        entityKind: input.entry.entityKind,
        entityId: input.entry.entityId,
        eventType: input.entry.eventType,
      });
      return;
    }
    try {
      await this.repository.createHistory(input.entry, input.transaction, input.context);
    } catch (error) {
      this.logger.error('Не удалось записать историю', error, {
        entityKind: input.entry.entityKind,
        entityId: input.entry.entityId,
        eventType: input.entry.eventType,
      });
      throw error;
    }
  }
}
