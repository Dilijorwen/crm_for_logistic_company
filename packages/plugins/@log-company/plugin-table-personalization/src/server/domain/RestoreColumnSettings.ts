/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { ColumnSettings, PersonalizableColumn } from '../../shared/contracts';
import { mergeSettings } from './ColumnPreferences';

export function restoreColumnSettings(
  submitted: ColumnSettings,
  previous: ColumnSettings | null,
  columns: PersonalizableColumn[],
  existingColumnUids: string[],
  resizableColumnUids: string[],
): ColumnSettings {
  const merged = mergeSettings(submitted, previous, columns, existingColumnUids, resizableColumnUids);
  const opaqueWidths = Object.fromEntries(
    Object.entries(previous?.columnWidths || {}).filter(
      ([uid]) => existingColumnUids.includes(uid) && !resizableColumnUids.includes(uid),
    ),
  );
  // A snapshot replaces all accessible widths, including removal of overrides that were automatic when saved.
  return { ...merged, columnWidths: { ...opaqueWidths, ...submitted.columnWidths } };
}
