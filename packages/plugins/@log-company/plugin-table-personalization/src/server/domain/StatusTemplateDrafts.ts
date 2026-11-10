/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { ColumnSettings, PersonalizableColumn } from '../../shared/contracts';
import type { SavedFilter } from '../../shared/filterTemplates';
import { MAX_FILTER_LENGTH, MAX_TEMPLATE_NAME } from './FilterTemplate';

export function statusTemplateDrafts(
  options: { value: string | number; label: string }[],
  columns: PersonalizableColumn[],
): { name: string; filter: SavedFilter; columnSettings: ColumnSettings }[] {
  const columnSettings: ColumnSettings = {
    version: 1,
    columnOrder: columns.map(({ uid }) => uid),
    hiddenColumnUids: columns.filter(({ source }) => source === 'collection').map(({ uid }) => uid),
  };
  const names = new Set<string>();
  const values = new Set<string | number>();
  return options.flatMap(({ value, label }) => {
    const name = label.trim();
    if (!name || name.length > MAX_TEMPLATE_NAME || /\p{Cc}/u.test(name) || names.has(name) || values.has(value)) {
      return [];
    }
    const filter: SavedFilter = { logic: '$and', items: [{ path: 'status', operator: '$eq', value }] };
    if (JSON.stringify(filter).length > MAX_FILTER_LENGTH) return [];
    names.add(name);
    values.add(value);
    return [{ name, filter, columnSettings }];
  });
}
