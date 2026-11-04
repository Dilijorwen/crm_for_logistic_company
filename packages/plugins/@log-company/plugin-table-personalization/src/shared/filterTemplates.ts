/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { ColumnSettings, TableIdentity } from './contracts';

export type FilterValue = null | string | number | boolean | FilterValue[] | { [key: string]: FilterValue };

export interface FilterCondition {
  path: string;
  operator: string;
  value?: FilterValue;
  noValue?: boolean;
}

export interface SavedFilter {
  logic: '$and' | '$or';
  items: (SavedFilter | FilterCondition)[];
}

export type FilterTemplateOperation = 'list' | 'create' | 'rename' | 'update' | 'delete';

export interface FilterTemplate {
  id: string;
  name: string;
  filter: SavedFilter;
  columnSettings: ColumnSettings;
  revision: number;
}

export interface FilterTemplateList {
  templates: FilterTemplate[];
  schemaSignature: string;
}

export interface FilterTemplateInput {
  identity: TableIdentity;
  id?: string;
  revision?: number;
  name?: string;
  filter?: SavedFilter;
  columnSettings?: ColumnSettings;
  schemaSignature?: string;
}

export interface TableTemplateSnapshot {
  filter: SavedFilter;
  columnSettings: ColumnSettings;
}

export function emptyFilter(): SavedFilter {
  return { logic: '$and', items: [] };
}
