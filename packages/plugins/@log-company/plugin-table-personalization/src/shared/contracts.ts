/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export interface TableIdentity {
  tableUid: string;
  referencePath: string[];
}

export interface ColumnSettings {
  version: 1;
  columnOrder: string[];
  hiddenColumnUids: string[];
  columnWidths?: Record<string, number>;
}

export const MIN_COLUMN_WIDTH = 50;
export const MAX_COLUMN_WIDTH = 3000;
export const RESIZABLE_TABLE_MODELS = [
  'TableBlockModel',
  'TableSelectModel',
  'SubTableFieldModel',
  'DisplaySubTableFieldModel',
  'PopupSubTableFieldModel',
] as const;
export const RESIZABLE_COLUMN_MODELS = [
  'TableColumnModel',
  'SubTableColumnModel',
  'TableActionsColumnModel',
  'JSColumnModel',
  'PopupSubTableActionsColumnModel',
] as const;

export type FixedGroup = 'left' | 'normal' | 'right';

export interface PersonalizableColumn {
  uid: string;
  title: string;
  fieldPath: string;
  fixed: FixedGroup;
  source?: 'collection';
}

export interface TablePersonalization {
  schemaSignature: string;
  columns: PersonalizableColumn[];
  settings: ColumnSettings | null;
  resizableColumnUids?: string[];
}

export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function fixedGroup(value: unknown): FixedGroup {
  return value === 'left' || value === true ? 'left' : value === 'right' ? 'right' : 'normal';
}
