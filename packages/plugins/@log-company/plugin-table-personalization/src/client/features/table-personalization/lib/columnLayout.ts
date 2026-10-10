/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { ColumnSettings, PersonalizableColumn } from '../../../../shared/contracts';
import { fixedGroup } from '../../../../shared/contracts';

export interface RenderedColumn<T> {
  uid: string;
  props: T & { fixed?: unknown; hidden?: boolean };
  canPersonalize: boolean;
}

const GROUPS = ['left', 'normal', 'right'] as const;

export function applyColumnLayout<T>(
  columns: RenderedColumn<T>[],
  settings: ColumnSettings | null,
): RenderedColumn<T>[] {
  const rank = new Map(settings?.columnOrder.map((uid, index) => [uid, index]) || []);
  const hidden = new Set(settings?.hiddenColumnUids || []);
  return GROUPS.flatMap((group) => {
    const current = columns.filter((column) => fixedGroup(column.props.fixed) === group);
    const personal = current
      .filter((column) => column.canPersonalize)
      .sort((left, right) => {
        return (rank.get(left.uid) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.uid) ?? Number.MAX_SAFE_INTEGER);
      });
    let position = 0;
    return current
      .map((column) => (column.canPersonalize ? personal[position++] : column))
      .filter((column) => !column.canPersonalize || !hidden.has(column.uid));
  });
}

export function normalizeDraft(settings: ColumnSettings | null, columns: PersonalizableColumn[]): ColumnSettings {
  const uids = new Set(columns.map((column) => column.uid));
  const order = settings?.columnOrder.filter((uid) => uids.has(uid)) || [];
  return {
    version: 1,
    columnOrder: GROUPS.flatMap((group) => {
      const groupUids = columns.filter((column) => column.fixed === group).map((column) => column.uid);
      return [...order.filter((uid) => groupUids.includes(uid)), ...groupUids.filter((uid) => !order.includes(uid))];
    }),
    hiddenColumnUids: [
      ...(settings?.hiddenColumnUids.filter((uid) => uids.has(uid)) || []),
      ...columns
        .filter((column) => column.source === 'collection' && !settings?.columnOrder.includes(column.uid))
        .map((column) => column.uid),
    ],
    ...(settings?.columnWidths ? { columnWidths: { ...settings.columnWidths } } : {}),
  };
}

export function moveDraftColumn(
  settings: ColumnSettings,
  columns: PersonalizableColumn[],
  source: string,
  target: string,
): ColumnSettings {
  if (
    source === target ||
    columns.find((column) => column.uid === source)?.fixed !== columns.find((column) => column.uid === target)?.fixed
  )
    return settings;
  const order = [...settings.columnOrder];
  const from = order.indexOf(source);
  const to = order.indexOf(target);
  if (from < 0 || to < 0) return settings;
  order.splice(from, 1);
  order.splice(to, 0, source);
  return { ...settings, columnOrder: order };
}
