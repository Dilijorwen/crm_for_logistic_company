/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export const PERMIT_DOCUMENT_TYPES = [
  'declaration_of_conformity',
  'certificate_of_conformity',
  'state_registration_certificate',
] as const;

export type PermitDocumentType = (typeof PERMIT_DOCUMENT_TYPES)[number];

export const PERMIT_DOCUMENT_STATUSES = ['valid', 'suspended', 'terminated'] as const;
export type PermitDocumentStatus = (typeof PERMIT_DOCUMENT_STATUSES)[number];

export const PERMIT_DOCUMENT_SYNC_STATUSES = ['PENDING', 'SUCCESS', 'NOT_FOUND', 'ERROR'] as const;
export type PermitDocumentSyncStatus = (typeof PERMIT_DOCUMENT_SYNC_STATUSES)[number];

export type PermitDocumentValidationErrorCode =
  | 'INVALID_DOCUMENT_TYPE'
  | 'INVALID_STATUS'
  | 'INVALID_SYNC_STATUS'
  | 'INVALID_DATE'
  | 'INVALID_DATE_RANGE'
  | 'MISSING_SUCCESS_FIELD'
  | 'UNEXPECTED_VALID_UNTIL';

export class PermitDocumentValidationError extends Error {
  constructor(readonly code: PermitDocumentValidationErrorCode) {
    super(code);
    this.name = 'PermitDocumentValidationError';
  }
}

export interface PermitDocumentPolicyInput {
  documentType: unknown;
  status: unknown;
  syncStatus: unknown;
  validFrom: unknown;
  validUntil: unknown;
  productInformation: unknown;
}

export function isPermitDocumentType(value: unknown): value is PermitDocumentType {
  return isAllowedValue(value, PERMIT_DOCUMENT_TYPES);
}

export function isPermitDocumentStatus(value: unknown): value is PermitDocumentStatus {
  return isAllowedValue(value, PERMIT_DOCUMENT_STATUSES);
}

export function isPermitDocumentSyncStatus(value: unknown): value is PermitDocumentSyncStatus {
  return isAllowedValue(value, PERMIT_DOCUMENT_SYNC_STATUSES);
}

function isAllowedValue<T extends string>(value: unknown, allowedValues: readonly T[]): value is T {
  return typeof value === 'string' && allowedValues.includes(value as T);
}

export function toCalendarDate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  if (typeof value !== 'string') {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    return null;
  }
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}

export function validatePermitDocument(input: PermitDocumentPolicyInput): void {
  if (!isPermitDocumentType(input.documentType)) {
    throw new PermitDocumentValidationError('INVALID_DOCUMENT_TYPE');
  }
  if (!isPermitDocumentSyncStatus(input.syncStatus)) {
    throw new PermitDocumentValidationError('INVALID_SYNC_STATUS');
  }

  if (input.status !== null && input.status !== undefined && !isPermitDocumentStatus(input.status)) {
    throw new PermitDocumentValidationError('INVALID_STATUS');
  }

  if (input.syncStatus !== 'SUCCESS') {
    validateOptionalDates(input.validFrom, input.validUntil);
    return;
  }

  if (!isPermitDocumentStatus(input.status)) {
    throw new PermitDocumentValidationError('MISSING_SUCCESS_FIELD');
  }
  const validFrom = toCalendarDate(input.validFrom);
  if (validFrom === null || !hasText(input.productInformation)) {
    throw new PermitDocumentValidationError('MISSING_SUCCESS_FIELD');
  }

  const validUntil = toCalendarDate(input.validUntil);
  if (input.documentType === 'state_registration_certificate') {
    if (input.validUntil !== null && input.validUntil !== undefined) {
      throw new PermitDocumentValidationError('UNEXPECTED_VALID_UNTIL');
    }
    return;
  }
  if (input.validUntil === null || input.validUntil === undefined) {
    return;
  }
  if (validUntil === null) {
    throw new PermitDocumentValidationError('INVALID_DATE');
  }
  if (validUntil < validFrom) {
    throw new PermitDocumentValidationError('INVALID_DATE_RANGE');
  }
}

function validateOptionalDates(validFromValue: unknown, validUntilValue: unknown): void {
  const hasValidFrom = validFromValue !== null && validFromValue !== undefined;
  const hasValidUntil = validUntilValue !== null && validUntilValue !== undefined;
  const validFrom = hasValidFrom ? toCalendarDate(validFromValue) : null;
  const validUntil = hasValidUntil ? toCalendarDate(validUntilValue) : null;
  if ((hasValidFrom && validFrom === null) || (hasValidUntil && validUntil === null)) {
    throw new PermitDocumentValidationError('INVALID_DATE');
  }
  if (validFrom !== null && validUntil !== null && validUntil < validFrom) {
    throw new PermitDocumentValidationError('INVALID_DATE_RANGE');
  }
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
