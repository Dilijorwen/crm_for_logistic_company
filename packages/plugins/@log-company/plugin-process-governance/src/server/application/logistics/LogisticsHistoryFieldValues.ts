/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { formatLogisticsHistoryValue } from '../../domain/logistics/LogisticsHistory';
import { extractIdentifier, sameIdentifier } from '../../domain/shared/Identifiers';
import type {
  LogisticsLogger,
  LogisticsRepository,
  LogisticsTransaction,
  TrackedLogisticsField,
} from './ports/LogisticsRepository';

export function isEmptyLogisticsHistoryValue(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

export function areLogisticsHistoryFieldValuesEqual(
  field: TrackedLogisticsField,
  oldValue: unknown,
  newValue: unknown,
): boolean {
  if (field.kind === 'belongsTo') {
    const oldIdentifier = extractIdentifier(oldValue, field.targetKey ?? 'id');
    const newIdentifier = extractIdentifier(newValue, field.targetKey ?? 'id');
    return (oldIdentifier === null && newIdentifier === null) || sameIdentifier(oldIdentifier, newIdentifier);
  }
  return formatLogisticsHistoryValue(oldValue) === formatLogisticsHistoryValue(newValue);
}

export async function formatLogisticsHistoryFieldValue(
  repository: LogisticsRepository,
  logger: LogisticsLogger,
  field: TrackedLogisticsField,
  value: unknown,
  transaction?: LogisticsTransaction,
): Promise<string> {
  if (field.kind === 'belongsTo') {
    const identifier = extractIdentifier(value, field.targetKey ?? 'id');
    if (identifier === null || !field.targetCollection) {
      return '';
    }
    try {
      return await repository.getRecordLabel(field.targetCollection, identifier, field.targetKey ?? 'id', transaction);
    } catch (error) {
      logger.error('Не удалось получить подпись связанной записи', error, {
        field: field.name,
        target: field.targetCollection,
        id: String(identifier),
      });
      return String(identifier);
    }
  }
  const enumOption = field.enumOptions?.find((option) => String(option.value) === String(value));
  return enumOption?.label || formatLogisticsHistoryValue(value);
}
