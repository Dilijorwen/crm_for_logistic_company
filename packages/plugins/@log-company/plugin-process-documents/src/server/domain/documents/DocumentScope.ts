/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ProcessDocumentsError } from './DocumentErrors';

export type DocumentScope = { mode: 'shipment'; shipmentId: string } | { mode: 'draft'; draftToken: string };

export interface ScopedRecord {
  shipmentId: string | null;
  draftToken: string | null;
}

export function parseIdentifier(value: unknown): string | null {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    return parseIdentifier(objectValue.id ?? objectValue.value ?? objectValue.filterByTk);
  }
  return String(value);
}

export function parseDraftToken(value: unknown): string | null {
  const token = parseIdentifier(value)?.trim();
  if (!token || !/^[a-zA-Z0-9_-]{16,120}$/.test(token)) {
    return null;
  }
  return token;
}

export function normalizeNullableIdentifier(value: unknown): string | null {
  return parseIdentifier(value);
}

export function recordMatchesScope(record: ScopedRecord, scope: DocumentScope): boolean {
  if (scope.mode === 'shipment') {
    return record.shipmentId === scope.shipmentId;
  }
  return record.shipmentId === null && record.draftToken === scope.draftToken;
}

export function assertRecordMatchesScope(record: ScopedRecord, scope: DocumentScope): void {
  if (!recordMatchesScope(record, scope)) {
    throw new ProcessDocumentsError('CROSS_SCOPE_FOLDER', 'Нельзя использовать папку другой поставки.');
  }
}

export function assertDraftOwner(
  record: ScopedRecord & { createdById: string | null },
  scope: DocumentScope,
  actor: { userId: string | null; isRoot: boolean },
): void {
  if (scope.mode !== 'draft' || record.draftToken !== scope.draftToken) {
    throw new ProcessDocumentsError('DRAFT_ACCESS_DENIED', 'Нет прав для действия с черновыми документами поставки.');
  }
  if (actor.isRoot || (actor.userId !== null && record.createdById === actor.userId)) {
    return;
  }
  throw new ProcessDocumentsError('DRAFT_ACCESS_DENIED', 'Нет прав для действия с черновыми документами поставки.');
}
