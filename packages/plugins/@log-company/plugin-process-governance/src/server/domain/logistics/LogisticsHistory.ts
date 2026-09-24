/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export type LogisticsEntityKind = 'run' | 'shipment';

export type LogisticsHistoryEventType =
  | 'created'
  | 'field_initialized'
  | 'field_changed'
  | 'parent_added'
  | 'parent_removed'
  | 'child_added'
  | 'child_removed'
  | 'manager_added'
  | 'manager_removed'
  | 'declarant_added'
  | 'declarant_removed'
  | 'shipment_attached'
  | 'shipment_detached'
  | 'run_attached'
  | 'run_detached';

export interface LogisticsHistoryEntry {
  entityKind: LogisticsEntityKind;
  entityId: string;
  eventType: LogisticsHistoryEventType;
  fieldName?: string | null;
  fieldLabel?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
}

export function formatLogisticsHistoryValue(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}
