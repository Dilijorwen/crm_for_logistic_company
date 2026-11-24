/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { APIClient } from '@nocobase/client';

interface HistoryRow {
  id: string | number;
  event_type?: string;
  field_label?: string;
  old_value?: string;
  new_value?: string;
  createdAt: string;
  createdBy?: { nickname?: string; username?: string };
}

export interface WorkspaceHistoryEntry extends HistoryRow {
  key: string;
  source: string;
}

const historyQuery = {
  paginate: false,
  sort: ['-createdAt', '-id'],
  fields: ['id', 'event_type', 'field_label', 'old_value', 'new_value', 'createdAt'],
  appends: ['createdBy'],
};

export async function loadWorkspaceHistory(
  api: Pick<APIClient, 'resource'>,
  runId: string,
): Promise<WorkspaceHistoryEntry[]> {
  const {
    data: { data: run },
  } = await api.resource('transport_runs').get({ filterByTk: runId, fields: ['run_number'] });
  const [runHistory, related] = await Promise.all([
    api.resource('transport_runs.history', runId).list(historyQuery),
    api.resource('transport_runs.shipments', runId).list({ paginate: false, fields: ['id', 'shipment_number'] }),
  ]);
  const shipments: Array<{ id: string | number; shipment_number?: string | number }> = related.data.data;
  const runRows: HistoryRow[] = runHistory.data.data;
  const runEntries = runRows.map((row) => ({
    ...row,
    key: `run:${row.id}`,
    source: recordLabel('Рейс', run.run_number),
  }));
  const shipmentEntries = await Promise.all(
    shipments.map(async (shipment) => {
      const source = recordLabel('Поставка', shipment.shipment_number);
      const response = await api.resource('shipments.history', shipment.id).list(historyQuery);
      const rows: HistoryRow[] = response.data.data;
      return rows.map((row) => ({ ...row, key: `shipment:${row.id}`, source }));
    }),
  );
  const entries = runEntries.concat(...shipmentEntries);

  return entries.sort(
    (first, second) =>
      Date.parse(second.createdAt) - Date.parse(first.createdAt) || second.key.localeCompare(first.key),
  );
}

function recordLabel(type: string, number: string | number | undefined): string {
  return number == null ? type : `${type} №${number}`;
}
