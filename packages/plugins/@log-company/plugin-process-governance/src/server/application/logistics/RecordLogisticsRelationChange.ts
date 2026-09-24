/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { LogisticsHistoryEventType } from '../../domain/logistics/LogisticsHistory';
import type { EntityId } from '../../domain/shared/Identifiers';
import type { LogisticsRepository, LogisticsTransaction } from './ports/LogisticsRepository';
import { WriteLogisticsHistory } from './WriteLogisticsHistory';

export interface RecordLogisticsRelationChangeInput {
  entityId: EntityId;
  relatedId: EntityId;
  relatedKind: 'run' | 'shipment' | 'user';
  eventType: Extract<
    LogisticsHistoryEventType,
    | 'parent_added'
    | 'parent_removed'
    | 'manager_added'
    | 'manager_removed'
    | 'declarant_added'
    | 'declarant_removed'
    | 'shipment_attached'
    | 'shipment_detached'
  >;
  fieldName: string;
  fieldLabel: string;
  transaction?: LogisticsTransaction;
  context?: unknown;
}

export class RecordLogisticsRelationChange {
  constructor(
    private readonly repository: LogisticsRepository,
    private readonly history: WriteLogisticsHistory,
  ) {}

  async execute(input: RecordLogisticsRelationChangeInput): Promise<void> {
    const label =
      input.relatedKind === 'run' || input.relatedKind === 'shipment'
        ? await this.repository.getEntityLabel(input.relatedKind, input.relatedId, input.transaction)
        : await this.repository.getRecordLabel('users', input.relatedId, 'id', input.transaction);
    const isRemoved = input.eventType.endsWith('_removed') || input.eventType === 'shipment_detached';
    await this.history.execute({
      entry: {
        entityKind: 'run',
        entityId: String(input.entityId),
        eventType: input.eventType,
        fieldName: input.fieldName,
        fieldLabel: input.fieldLabel,
        oldValue: isRemoved ? label : null,
        newValue: isRemoved ? null : label,
      },
      transaction: input.transaction,
      context: input.context,
    });
    if (input.relatedKind === 'shipment') {
      const runLabel = await this.repository.getEntityLabel('run', input.entityId, input.transaction);
      await this.history.execute({
        entry: {
          entityKind: 'shipment',
          entityId: String(input.relatedId),
          eventType: isRemoved ? 'run_detached' : 'run_attached',
          fieldName: 'runs',
          fieldLabel: 'Рейсы',
          oldValue: isRemoved ? runLabel : null,
          newValue: isRemoved ? null : runLabel,
        },
        transaction: input.transaction,
        context: input.context,
      });
    }
    if (input.relatedKind === 'run' && input.eventType.startsWith('parent_')) {
      const childLabel = await this.repository.getEntityLabel('run', input.entityId, input.transaction);
      await this.history.execute({
        entry: {
          entityKind: 'run',
          entityId: String(input.relatedId),
          eventType: isRemoved ? 'child_removed' : 'child_added',
          fieldName: 'child_runs',
          fieldLabel: 'Дочерние рейсы',
          oldValue: isRemoved ? childLabel : null,
          newValue: isRemoved ? null : childLabel,
        },
        transaction: input.transaction,
        context: input.context,
      });
    }
  }
}
