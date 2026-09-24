/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { LogisticsEntityKind } from '../../domain/logistics/LogisticsHistory';
import { extractIdentifier, type EntityId } from '../../domain/shared/Identifiers';
import { areLogisticsHistoryFieldValuesEqual, formatLogisticsHistoryFieldValue } from './LogisticsHistoryFieldValues';
import { LogisticsSnapshotStore } from './LogisticsSnapshotStore';
import type { LogisticsLogger, LogisticsRepository, LogisticsTransaction } from './ports/LogisticsRepository';
import { WriteLogisticsHistory } from './WriteLogisticsHistory';

export interface RecordLogisticsFieldChangesInput {
  entityKind: LogisticsEntityKind;
  entityId: EntityId;
  transaction?: LogisticsTransaction;
  snapshotScope?: unknown;
  context?: unknown;
}

export class RecordLogisticsFieldChanges {
  constructor(
    private readonly repository: LogisticsRepository,
    private readonly snapshots: LogisticsSnapshotStore,
    private readonly history: WriteLogisticsHistory,
    private readonly logger: LogisticsLogger,
  ) {}

  async execute(input: RecordLogisticsFieldChangesInput): Promise<void> {
    const before = this.snapshots.take(input.entityKind, input.entityId, input.snapshotScope);
    if (!before) {
      return;
    }
    const fields = this.repository.getTrackedFields(input.entityKind);
    const after = await this.repository.findEntityValues(input.entityKind, input.entityId, fields, input.transaction);
    if (!after) {
      return;
    }

    for (const field of fields) {
      if (areLogisticsHistoryFieldValuesEqual(field, before[field.name], after[field.name])) {
        continue;
      }
      let oldValue = await formatLogisticsHistoryFieldValue(
        this.repository,
        this.logger,
        field,
        before[field.name],
        input.transaction,
      );
      let newValue = await formatLogisticsHistoryFieldValue(
        this.repository,
        this.logger,
        field,
        after[field.name],
        input.transaction,
      );
      if (field.kind === 'belongsTo' && oldValue === newValue) {
        const oldIdentifier = extractIdentifier(before[field.name], field.targetKey ?? 'id');
        const newIdentifier = extractIdentifier(after[field.name], field.targetKey ?? 'id');
        oldValue = `${oldValue} (ID: ${String(oldIdentifier)})`;
        newValue = `${newValue} (ID: ${String(newIdentifier)})`;
      }
      await this.history.execute({
        entry: {
          entityKind: input.entityKind,
          entityId: String(input.entityId),
          eventType: 'field_changed',
          fieldName: field.name,
          fieldLabel: field.label,
          oldValue,
          newValue,
        },
        transaction: input.transaction,
        context: input.context,
      });
    }
  }
}
