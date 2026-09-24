/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { LogisticsEntityKind } from '../../domain/logistics/LogisticsHistory';
import type { EntityId } from '../../domain/shared/Identifiers';
import { formatLogisticsHistoryFieldValue, isEmptyLogisticsHistoryValue } from './LogisticsHistoryFieldValues';
import type { LogisticsLogger, LogisticsRepository, LogisticsTransaction } from './ports/LogisticsRepository';
import { WriteLogisticsHistory } from './WriteLogisticsHistory';

export interface RecordLogisticsCreatedInput {
  entityKind: LogisticsEntityKind;
  entityId: EntityId;
  transaction?: LogisticsTransaction;
  context?: unknown;
}

export class RecordLogisticsCreated {
  constructor(
    private readonly repository: LogisticsRepository,
    private readonly history: WriteLogisticsHistory,
    private readonly logger: LogisticsLogger,
  ) {}

  async execute(input: RecordLogisticsCreatedInput): Promise<void> {
    await this.history.execute({
      entry: {
        entityKind: input.entityKind,
        entityId: String(input.entityId),
        eventType: 'created',
        fieldLabel: input.entityKind === 'run' ? 'Создан рейс' : 'Создана поставка',
        newValue: await this.repository.getEntityLabel(input.entityKind, input.entityId, input.transaction),
      },
      transaction: input.transaction,
      context: input.context,
    });

    const fields = this.repository.getTrackedFields(input.entityKind);
    const values = await this.repository.findEntityValues(input.entityKind, input.entityId, fields, input.transaction);
    if (!values) {
      return;
    }
    for (const field of fields) {
      const value = values[field.name];
      if (isEmptyLogisticsHistoryValue(value)) {
        continue;
      }
      await this.history.execute({
        entry: {
          entityKind: input.entityKind,
          entityId: String(input.entityId),
          eventType: 'field_initialized',
          fieldName: field.name,
          fieldLabel: field.label,
          oldValue: null,
          newValue: await formatLogisticsHistoryFieldValue(
            this.repository,
            this.logger,
            field,
            value,
            input.transaction,
          ),
        },
        transaction: input.transaction,
        context: input.context,
      });
    }
  }
}
