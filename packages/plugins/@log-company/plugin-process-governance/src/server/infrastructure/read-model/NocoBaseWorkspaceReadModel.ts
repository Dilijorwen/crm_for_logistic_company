/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { literal, type Database, type Filter, type Repository } from '@nocobase/database';
import type {
  WorkspacePage,
  WorkspacePageQuery,
  WorkspaceReadModel,
} from '../../application/logistics/ports/WorkspaceReadModel';
import type { WorkspaceRunLink } from '../../../shared/workspace';
import { LOGISTICS_WORKSPACE_FIELD_SOURCES } from './LogisticsWorkspaceFields';

const RUN_FIELDS = LOGISTICS_WORKSPACE_FIELD_SOURCES.filter((field) => field.resource === 'transport_runs').map(
  (field) => field.name,
);
const LINK_FIELDS = ['run_number', 'registration_number', 'transport_type', 'departure_city_name'] as const;

function json(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  const model = value as { toJSON?(): Record<string, unknown> };
  return model.toJSON ? model.toJSON() : (value as Record<string, unknown>);
}

/** Uses the same source ACL scope as the native table, with pagination by whole runs. */
export class NocoBaseWorkspaceReadModel implements WorkspaceReadModel {
  constructor(private readonly db: Database) {}

  async findPage(query: WorkspacePageQuery): Promise<WorkspacePage> {
    const repository: Repository = this.db.getRepository('logistics_work_items');
    const count = Number(
      await repository.aggregate({ method: 'count', field: 'run_id', distinct: true, filter: query.filter as Filter }),
    );
    const shipmentCount = Number(
      await repository.aggregate({
        method: 'count',
        field: 'shipment_id',
        distinct: true,
        filter: query.filter as Filter,
      }),
    );
    const page = Math.min(query.page, Math.max(1, Math.ceil(count / query.pageSize)));
    const runSort = query.sort.filter((field) => RUN_FIELDS.includes(field.replace(/^-/, '')));
    if (!runSort.length) runSort.push('run_number');
    const groupFields = [...new Set(['run_id', ...runSort.map((field) => field.replace(/^-/, ''))])];
    const runs = await this.groupRows(repository, {
      filter: query.filter,
      fields: groupFields,
      sort: [...runSort, 'run_id'],
      offset: (page - 1) * query.pageSize,
      limit: query.pageSize,
    });
    const runIds = runs.map((row) => String(json(row).run_id));
    const output: WorkspacePage = {
      rows: [],
      count,
      page,
      pageSize: query.pageSize,
      totalPage: Math.ceil(count / query.pageSize),
      workspace: { shipmentCount, runTotals: {}, shipmentRuns: {} },
    };
    if (!runIds.length) return output;
    const rows: unknown[] = await repository.find({
      filter: { $and: [query.filter, { run_id: { $in: runIds } }] } as Filter,
      fields: query.fields,
      sort: query.sort.length ? query.sort : ['shipment_number'],
    });
    const order = new Map(runIds.map((id, index) => [id, index]));
    output.rows = rows.map(json).sort((left, right) => {
      const leftRun = String(left.id).split(':')[0];
      const rightRun = String(right.id).split(':')[0];
      return (order.get(leftRun) || 0) - (order.get(rightRun) || 0);
    });
    const fields = ['run_id', 'shipment_id', ...LINK_FIELDS.filter((field) => query.fields.includes(field))];
    const runLinks = await this.groupRows(repository, {
      filter: { $and: [query.scopeFilter, { run_id: { $in: runIds } }] },
      fields,
    });
    const shipmentIds = [
      ...new Set(
        runLinks
          .map(json)
          .filter((row) => row.shipment_id != null)
          .map((row) => String(row.shipment_id)),
      ),
    ];
    const links = shipmentIds.length
      ? await this.groupRows(repository, {
          filter: { $and: [query.scopeFilter, { shipment_id: { $in: shipmentIds } }] },
          fields,
        })
      : runLinks;
    const totals = new Map<string, Set<string>>();
    for (const row of links.map(json)) {
      const runId = String(row.run_id);
      const shipmentId = row.shipment_id == null ? null : String(row.shipment_id);
      if (!totals.has(runId)) totals.set(runId, new Set());
      if (!shipmentId) continue;
      totals.get(runId)?.add(shipmentId);
      if (!shipmentIds.includes(shipmentId)) continue;
      const target: WorkspaceRunLink = { id: runId };
      for (const field of LINK_FIELDS) {
        const value = row[field];
        if (field === 'run_number' && typeof value === 'number') target.run_number = value;
        else if (field !== 'run_number' && typeof value === 'string') target[field] = value;
      }
      const related = output.workspace.shipmentRuns[shipmentId] || [];
      if (!related.some((link) => link.id === runId)) related.push(target);
      output.workspace.shipmentRuns[shipmentId] = related;
    }
    for (const runId of runIds) output.workspace.runTotals[runId] = totals.get(runId)?.size || 0;
    return output;
  }

  private async groupRows(
    repository: Repository,
    options: { filter: Record<string, unknown>; fields: string[]; sort?: string[]; offset?: number; limit?: number },
  ): Promise<unknown[]> {
    const quote = (field: string) =>
      literal(this.db.sequelize.getQueryInterface().quoteIdentifiers(`logistics_work_items.${field}`));
    // Repository.find's eager loader always appends the primary key. It would split
    // a run into shipment rows and breaks GROUP BY on PostgreSQL. Keep its filter
    // parser and joins, then issue the aggregate projection through Sequelize.
    const parsed = repository.buildQueryOptions({
      ...options,
      sort: [...(options.sort || [])],
      group: options.fields,
    });
    return repository.model.findAll({
      ...parsed,
      attributes: options.fields.map((field) => [quote(field), field]),
      group: options.fields.map(quote),
      // NocoBase adds a primary-key tie-breaker to its default order. The view's
      // row ID is not part of this aggregate; use only the requested group keys.
      order: (options.sort || []).map((field): [ReturnType<typeof literal>, string] => [
        quote(field.replace(/^-/, '')),
        `${field.startsWith('-') ? 'DESC' : 'ASC'} NULLS LAST`,
      ]),
      raw: true,
      subQuery: false,
      includeIgnoreAttributes: false,
    });
  }
}
