/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export function isDocumentAccessDenied(error: unknown): boolean {
  return record(record(error).response).status === 403;
}

export function getDocumentErrorText(error: unknown, fallback: string): string {
  const errorRecord = record(error);
  const responseData = record(record(errorRecord.response).data);
  const errors = Array.isArray(responseData.errors) ? responseData.errors : [];
  return String(record(errors[0]).message || responseData.message || errorRecord.message || fallback);
}
