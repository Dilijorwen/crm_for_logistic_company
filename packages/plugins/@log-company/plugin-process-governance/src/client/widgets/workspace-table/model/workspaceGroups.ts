/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { WorkspaceRow, WorkspaceTableMeta } from '../../../../shared/workspace';
import { workspaceRecordIds } from '../../../shared/lib';

export interface WorkspaceRunGroup {
  id: string;
  row: WorkspaceRow;
  shipments: WorkspaceRow[];
  total: number;
  parity: number;
}

export function workspaceGroups(rows: WorkspaceRow[], meta?: WorkspaceTableMeta): WorkspaceRunGroup[] {
  const groups = new Map<string, WorkspaceRunGroup>();
  for (const row of rows) {
    const ids = workspaceRecordIds(row.id);
    if (!ids) continue;
    let group = groups.get(ids.runId);
    if (!group) {
      group = { id: ids.runId, row, shipments: [], total: 0, parity: groups.size % 2 };
      groups.set(ids.runId, group);
    }
    if (ids.shipmentId) group.shipments.push(row);
  }
  for (const group of groups.values()) group.total = meta?.runTotals[group.id] ?? group.shipments.length;
  return [...groups.values()];
}

export function groupedTableRows(groups: WorkspaceRunGroup[], collapsed: string[]): WorkspaceRow[] {
  return groups.flatMap((group) => {
    const header = { ...group.row, id: `run:${group.id}`, workspaceHeader: true };
    if (collapsed.includes(group.id)) return [header];
    return [header, ...(group.shipments.length ? group.shipments : [{ ...group.row, id: `${group.id}:0` }])];
  });
}

/** Selecting/deselecting one occurrence changes every visible occurrence of that shipment. */
export function synchronizedShipmentSelection(
  previous: WorkspaceRow[],
  requested: WorkspaceRow[],
  available: WorkspaceRow[],
): WorkspaceRow[] {
  const requestedKeys = new Set(requested.map((row) => row.id));
  const deselected = new Set(
    previous
      .filter((row) => !requestedKeys.has(row.id))
      .map((row) => workspaceRecordIds(row.id)?.shipmentId)
      .filter(Boolean),
  );
  const selected = new Set(
    requested.map((row) => workspaceRecordIds(row.id)?.shipmentId).filter((id) => id && !deselected.has(id)),
  );
  const rows = [...requested, ...available].filter((row) => selected.has(workspaceRecordIds(row.id)?.shipmentId));
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}
