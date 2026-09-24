/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function responseData(response: unknown): unknown {
  const responseRecord = asRecord(response);
  const payload = asRecord(responseRecord.data);
  return Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : responseRecord.data;
}

export function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

export function responseRecords(response: unknown): Record<string, unknown>[] {
  return recordArray(responseData(response));
}

export function responseRecord(response: unknown): Record<string, unknown> {
  return asRecord(responseData(response));
}

export function identifier(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' ? String(value) : '';
}

export function stringValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' ? String(value) : '';
}

export function numberValue(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export function booleanValue(value: unknown): boolean {
  return value === true;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  const response = asRecord(asRecord(error).response);
  const data = asRecord(response.data);
  const errors = data.errors;
  if (Array.isArray(errors)) {
    const first = asRecord(errors[0]);
    if (typeof first.message === 'string') {
      return first.message;
    }
  }
  if (typeof data.message === 'string') {
    return data.message;
  }
  return fallback;
}

export function isFormValidationError(error: unknown): boolean {
  return Array.isArray(asRecord(error).errorFields);
}

export { asRecord };
