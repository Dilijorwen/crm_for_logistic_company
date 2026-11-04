/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import type { WorkspaceRow } from '../../../../../shared/workspace';
import { groupedTableRows, synchronizedShipmentSelection, workspaceGroups } from '../workspaceGroups';

const rows: WorkspaceRow[] = [
  { id: '10:100', run_number: 30, shipment_number: 20 },
  { id: '10:101', run_number: 30, shipment_number: 21 },
  { id: '11:100', run_number: 31, shipment_number: 20 },
  { id: '12:0', run_number: 32, shipment_number: null },
];

describe('workspace run groups and shared shipment selection', () => {
  it('groups shipments by their run and retains an empty run', () => {
    const groups = workspaceGroups(rows);
    expect(groups.map((group) => [group.id, group.shipments.length, group.total])).toEqual([
      ['10', 2, 2],
      ['11', 1, 1],
      ['12', 0, 0],
    ]);
    expect(groups[0].shipments[0].id).toBe('10:100');
    expect(groups[1].shipments[0].id).toBe('11:100');
  });

  it('keeps the full accessible count when a filter hides some shipments', () => {
    const groups = workspaceGroups(rows.slice(0, 1), { shipmentCount: 1, runTotals: { '10': 2 }, shipmentRuns: {} });
    expect(groups[0]).toMatchObject({ total: 2 });
    expect(groups[0].shipments).toHaveLength(1);
  });

  it('collapses only one group while keeping every run header and the empty state', () => {
    const projected = groupedTableRows(workspaceGroups(rows), ['10']);
    expect(projected.map((row) => row.id)).toEqual(['run:10', 'run:11', '11:100', 'run:12', '12:0']);
    expect(rows).toHaveLength(4);
  });

  it('selects every occurrence of a shipment and deselects them together', () => {
    const selected = synchronizedShipmentSelection([], [rows[0]], rows);
    expect(selected.map((row) => row.id)).toEqual(['10:100', '11:100']);
    expect(synchronizedShipmentSelection(selected, [rows[2]], rows)).toEqual([]);
    expect(synchronizedShipmentSelection(selected, [rows[0]], rows)).toEqual([]);
  });

  it('does not select empty runs or synthetic headers and preserves other shipments', () => {
    const selected = synchronizedShipmentSelection([], rows, rows);
    expect(selected.map((row) => row.id)).toEqual(['10:100', '10:101', '11:100']);
    const next = synchronizedShipmentSelection(selected, [rows[1], rows[2]], rows);
    expect(next.map((row) => row.id)).toEqual(['10:101']);
    expect(synchronizedShipmentSelection([], [{ id: 'run:10', workspaceHeader: true }, rows[3]], rows)).toEqual([]);
  });
});
