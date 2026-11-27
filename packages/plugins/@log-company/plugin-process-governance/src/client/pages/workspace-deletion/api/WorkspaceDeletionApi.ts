/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { APIClient } from '@nocobase/client';
import { TRANSPORT_TYPE_LABELS, type TransportType } from '../../../../shared/transport';

type WireRow = Record<string, unknown> & { id: string | number };
export interface DeletionShipment {
  id: string;
  number: string;
  client: string;
  invoice: string;
  declaration: string;
  application: string;
}
export interface DeletionRun {
  id: string;
  number: string;
  transport: string;
  registration: string;
  managers: string;
  declarants: string;
  shipments: DeletionShipment[];
}
export interface DeletionPage<T> {
  rows: T[];
  total: number;
}

export const deletionPageSize = 9;
const shipmentFields = [
  'id',
  'shipment_number',
  'chinese_client',
  'invoice_number',
  'declaration_number',
  'application_number',
];

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) || '—' : '—';
}

function names(values: unknown, title: (value: WireRow) => unknown): string {
  return Array.isArray(values) && values.length ? values.map((value) => text(title(value))).join(', ') : '—';
}

function shipment(row: WireRow): DeletionShipment {
  return {
    id: String(row.id),
    number: text(row.shipment_number),
    client: names(row.chinese_client, (client) => client.name),
    invoice: text(row.invoice_number),
    declaration: text(row.declaration_number),
    application: text(row.application_number),
  };
}

export class WorkspaceDeletionApi {
  constructor(private readonly api: APIClient) {}

  async runs(page: number, canReadShipments: boolean): Promise<DeletionPage<DeletionRun>> {
    const { data } = await this.api.resource('transport_runs').list({
      page,
      pageSize: deletionPageSize,
      sort: ['-run_number', '-id'],
      appends: ['managers', 'declarants'],
      fields: ['id', 'run_number', 'transport_type', 'registration_number_input', 'managers', 'declarants'],
    });
    const rows = await Promise.all(
      (data.data as WireRow[]).map(async (row) => {
        const id = String(row.id);
        // The standard association list applies the same permissions as the workspace summary.
        const linked = canReadShipments
          ? await this.api.resource('transport_runs.shipments', id).list({
              paginate: false,
              sort: ['shipment_number', 'id'],
              fields: shipmentFields,
              appends: ['chinese_client'],
            })
          : undefined;
        return {
          id,
          number: text(row.run_number),
          transport: TRANSPORT_TYPE_LABELS[row.transport_type as TransportType] ?? text(row.transport_type),
          registration: text(row.registration_number_input),
          managers: names(row.managers, (person) => person.nickname || person.username),
          declarants: names(row.declarants, (person) => person.nickname || person.username),
          shipments: (linked?.data?.data ?? []).map(shipment),
        };
      }),
    );
    return { rows, total: Number(data.meta?.count ?? rows.length) };
  }

  async standaloneShipments(page: number): Promise<DeletionPage<DeletionShipment>> {
    const { data } = await this.api.resource('shipments').list({
      page,
      pageSize: deletionPageSize,
      sort: ['-shipment_number', '-id'],
      filter: { 'runs.id': { $notExists: true } },
      fields: shipmentFields,
      appends: ['chinese_client'],
    });
    const rows = (data.data as WireRow[]).map(shipment);
    return { rows, total: Number(data.meta?.count ?? rows.length) };
  }

  async remove(runIds: string[], shipmentIds: string[]): Promise<void> {
    await this.api.request({
      method: 'post',
      url: 'logisticsWorkspace:destroySelection',
      data: { runIds, shipmentIds },
    });
  }
}
