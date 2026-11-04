/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { FlowModel } from '@nocobase/flow-engine';

export interface SummaryPerson {
  id: string;
  name: string;
}
export interface SummaryRun {
  id: string;
  number: string;
  registration: string;
}
export interface SummaryShipment {
  id: string;
  number: string;
  client: string;
  invoice: string;
  status?: string;
}
export interface RunSummary {
  managers: SummaryPerson[];
  declarants: SummaryPerson[];
  parents: SummaryRun[];
  children: SummaryRun[];
  shipments: SummaryShipment[];
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function label(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '—';
}
function items(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(object) : [];
}
function people(value: unknown): SummaryPerson[] {
  return items(value).map((item) => ({ id: String(item.id), name: label(item.nickname || item.username) }));
}
function runs(value: unknown): SummaryRun[] {
  return items(value).map((item) => ({
    id: String(item.id),
    number: label(item.run_number),
    registration: label(item.registration_number_input),
  }));
}

export class WorkspaceSummaryApi {
  constructor(private readonly api: FlowModel['context']['api']) {}

  async get(runId: string): Promise<RunSummary> {
    const results = await Promise.allSettled([
      this.api
        .resource('transport_runs')
        .get({ filterByTk: runId, appends: ['managers', 'declarants', 'parent_runs', 'child_runs'] }),
      this.api.resource('transport_runs.shipments', runId).list({
        paginate: false,
        fields: ['id', 'shipment_number', 'invoice_number', 'status', 'chinese_client'],
        appends: ['chinese_client'],
        sort: ['shipment_number'],
      }),
    ]);
    const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failure) throw failure.reason;
    const [runResponse, shipmentsResponse] = results.map((result) =>
      result.status === 'fulfilled' ? result.value : undefined,
    );
    const run = object(runResponse?.data?.data);
    return {
      managers: people(run.managers),
      declarants: people(run.declarants),
      parents: runs(run.parent_runs),
      children: runs(run.child_runs),
      shipments: items(shipmentsResponse?.data?.data).map((item) => ({
        id: String(item.id),
        number: label(item.shipment_number),
        client: label(object(item.chinese_client).name),
        invoice: label(item.invoice_number),
        status: typeof item.status === 'string' ? item.status : undefined,
      })),
    };
  }
}
