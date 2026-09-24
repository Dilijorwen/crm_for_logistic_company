/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { LogisticsError } from './LogisticsError';

const LOCALIZED_DECIMAL_PATTERN = /^\d+(?:[.,]\d+)?$/;

export function normalizeShipmentDecimal(value: unknown, fieldLabel: string): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }

  const normalizedValue = typeof value === 'string' ? normalizeString(value) : value;
  const parsedValue = typeof normalizedValue === 'number' ? normalizedValue : Number.NaN;
  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw invalidDecimal(fieldLabel);
  }
  return parsedValue;
}

function normalizeString(value: string): number {
  const compactValue = value.normalize('NFKC').replace(/[\s\u00a0\u202f]/g, '');
  if (!LOCALIZED_DECIMAL_PATTERN.test(compactValue)) {
    return Number.NaN;
  }
  return Number(compactValue.replace(',', '.'));
}

function invalidDecimal(fieldLabel: string): LogisticsError {
  return new LogisticsError(
    'INVALID_SHIPMENT_DECIMAL',
    `Поле «${fieldLabel}» должно содержать неотрицательное число. Используйте запятую или точку как десятичный разделитель.`,
  );
}
