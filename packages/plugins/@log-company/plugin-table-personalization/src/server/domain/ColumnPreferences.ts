/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { ColumnSettings, PersonalizableColumn, TableIdentity } from '../../shared/contracts';
import { MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH, record } from '../../shared/contracts';
import { PersonalizationError } from './PersonalizationError';

export const MAX_COLUMNS = 500;
const MAX_REFERENCE_DEPTH = 20;
const UID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

function invalid(): never {
  throw new PersonalizationError('INVALID_SETTINGS');
}

function uniqueUids(value: unknown, limit: number): string[] {
  if (!Array.isArray(value) || value.length > limit) return invalid();
  if (value.some((uid) => typeof uid !== 'string' || !UID_PATTERN.test(uid))) return invalid();
  const uids = value as string[];
  if (new Set(uids).size !== uids.length) return invalid();
  return [...uids];
}

function exactKeys(value: Record<string, unknown>, keys: string[]): void {
  if (Object.keys(value).some((key) => !keys.includes(key)) || keys.some((key) => !(key in value))) invalid();
}

export function parseIdentity(value: unknown): TableIdentity {
  const input = record(value);
  exactKeys(input, ['tableUid', 'referencePath']);
  if (typeof input.tableUid !== 'string' || !UID_PATTERN.test(input.tableUid)) return invalid();
  const referencePath = uniqueUids(input.referencePath, MAX_REFERENCE_DEPTH);
  if (referencePath.includes(input.tableUid)) return invalid();
  return { tableUid: input.tableUid, referencePath };
}

export function parseSettings(value: unknown): ColumnSettings {
  const input = record(value);
  exactKeys(input, [
    'version',
    'columnOrder',
    'hiddenColumnUids',
    ...('columnWidths' in input ? ['columnWidths'] : []),
  ]);
  if (input.version !== 1) return invalid();
  const columnOrder = uniqueUids(input.columnOrder, MAX_COLUMNS);
  const hiddenColumnUids = uniqueUids(input.hiddenColumnUids, MAX_COLUMNS);
  if (hiddenColumnUids.some((uid) => !columnOrder.includes(uid))) return invalid();
  return {
    version: 1,
    columnOrder,
    hiddenColumnUids,
    ...('columnWidths' in input ? { columnWidths: parseColumnWidths(input.columnWidths) } : {}),
  };
}

export function parseColumnWidth(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < MIN_COLUMN_WIDTH || value > MAX_COLUMN_WIDTH)
    invalid();
  return value;
}

function parseColumnWidths(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const entries = Object.entries(value);
  if (entries.length > MAX_COLUMNS) invalid();
  return Object.fromEntries(
    entries.map(([uid, width]) => {
      if (!UID_PATTERN.test(uid) || ['__proto__', 'constructor', 'prototype'].includes(uid)) invalid();
      return [uid, parseColumnWidth(width)];
    }),
  );
}

export function parseWidthChange(columnUid: unknown, width: unknown): { columnUid: string; width: number | null } {
  if (
    typeof columnUid !== 'string' ||
    !UID_PATTERN.test(columnUid) ||
    ['__proto__', 'constructor', 'prototype'].includes(columnUid)
  )
    invalid();
  return { columnUid, width: width === null ? null : parseColumnWidth(width) };
}

export function effectiveSettings(
  settings: ColumnSettings | null,
  columns: PersonalizableColumn[],
  resizableColumnUids = columns.map((column) => column.uid),
): ColumnSettings | null {
  if (!settings) return null;
  const available = new Set(columns.map((column) => column.uid));
  const known = settings.columnOrder.filter((uid) => available.has(uid));
  const newHidden = columns
    .filter((column) => column.source === 'collection' && !settings.columnOrder.includes(column.uid))
    .map((column) => column.uid);
  return {
    version: 1,
    columnOrder: [...known, ...columns.map((column) => column.uid).filter((uid) => !known.includes(uid))],
    hiddenColumnUids: [...settings.hiddenColumnUids.filter((uid) => available.has(uid)), ...newHidden],
    ...(settings.columnWidths
      ? {
          columnWidths: Object.fromEntries(
            Object.entries(settings.columnWidths).filter(([uid]) => resizableColumnUids.includes(uid)),
          ),
        }
      : {}),
  };
}

// Restricted fields stay opaque in storage: changing roles must not erase their personal settings.
export function mergeSettings(
  submitted: ColumnSettings,
  previous: ColumnSettings | null,
  columns: PersonalizableColumn[],
  existingColumnUids: string[],
  resizableColumnUids = columns.map((column) => column.uid),
): ColumnSettings {
  const allowed = new Set(columns.map((column) => column.uid));
  if (submitted.columnOrder.some((uid) => !allowed.has(uid))) throw new PersonalizationError('FORBIDDEN');
  if (Object.keys(submitted.columnWidths || {}).some((uid) => !resizableColumnUids.includes(uid)))
    throw new PersonalizationError('FORBIDDEN');
  const existing = new Set(existingColumnUids);
  const editable = new Set(submitted.columnOrder);
  const opaque = previous?.columnOrder.filter((uid) => existing.has(uid) && !editable.has(uid)) || [];
  const queue = [...submitted.columnOrder];
  const baseline = [
    ...(previous?.columnOrder || []),
    ...columns.map((column) => column.uid).filter((uid) => !previous?.columnOrder.includes(uid)),
  ];
  const order = baseline
    .filter((uid) => existing.has(uid))
    .map((uid) => {
      return editable.has(uid) ? queue.shift() : uid;
    })
    .filter((uid): uid is string => !!uid);
  return {
    version: 1,
    columnOrder: [...order, ...queue],
    hiddenColumnUids: [
      ...submitted.hiddenColumnUids,
      ...(previous?.hiddenColumnUids.filter((uid) => opaque.includes(uid)) || []),
      ...columns
        .filter(
          (column) =>
            column.source === 'collection' && !editable.has(column.uid) && !previous?.columnOrder.includes(column.uid),
        )
        .map((column) => column.uid),
    ],
    ...(submitted.columnWidths || previous?.columnWidths
      ? {
          columnWidths: Object.fromEntries(
            Object.entries({ ...previous?.columnWidths, ...submitted.columnWidths }).filter(([uid]) =>
              existing.has(uid),
            ),
          ),
        }
      : {}),
  };
}
