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

export function unwrapResponse<T>(response: unknown): T {
  const responseRecord = asRecord(response);
  const payload = asRecord(responseRecord.data);
  return (Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : responseRecord.data) as T;
}

export function errorMessage(error: unknown, fallback: string): string {
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
