/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import actions, { type Context, type Next } from '@nocobase/actions';
import { createMockDatabase, type Database, type Model } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import logisticsWorkItems from '../../../collections/logisticsWorkItems';
import { LogisticsWorkspaceActions } from '../LogisticsWorkspaceActions';
import { NocoBaseWorkspaceReadModel } from '../../../infrastructure/read-model/NocoBaseWorkspaceReadModel';

type Handler = (context: Context, next: Next) => Promise<void>;
interface Permission {
  params?: { fields?: string[]; filter?: Record<string, unknown> };
}

describe('logistics workspace authorization and live search', () => {
  let db: Database;
  let authorize: Handler;
  let search: Handler;
  let groupedList: Handler;

  beforeEach(async () => {
    db = await createMockDatabase({ dialect: 'sqlite', storage: ':memory:' });
    db.collection({ name: 'transport_runs', fields: [{ type: 'integer', name: 'run_number' }] });
    db.collection({ name: 'shipments', fields: [{ type: 'string', name: 'status' }] });
    db.collection({ ...logisticsWorkItems, view: false });
    await db.sync();
    await db.getRepository('transport_runs').create({
      values: [
        { id: 10, run_number: 30 },
        { id: 11, run_number: 31 },
      ],
    });
    await db.getRepository('shipments').create({
      values: [
        { id: 100, status: 'queue' },
        { id: 101, status: 'released' },
      ],
    });
    await db.getRepository('logistics_work_items').create({
      values: [
        {
          id: '10:100',
          run_id: 10,
          shipment_id: 100,
          run_number: 30,
          transport_type: 'road',
          shipment_number: 100,
          registration_number: 'AB123',
          manager_comment: 'Скрытая заметка',
          status: 'queue',
        },
        { id: '10:101', run_id: 10, shipment_id: 101, run_number: 30, registration_number: 'AB123', status: 'release' },
        {
          id: '11:100',
          run_id: 11,
          shipment_id: 100,
          run_number: 31,
          transport_type: 'sea',
          registration_number: 'CD456',
          status: 'queue',
        },
        { id: '10:0', run_id: 10, shipment_id: null, run_number: 30, registration_number: 'EF789' },
      ],
    });
    const plugin = {
      db,
      app: {
        resourceManager: {
          use(handler: Handler) {
            authorize = handler;
          },
          define(definition: { actions: { list: Handler; searchCurrentCollection: Handler } }) {
            search = definition.actions.searchCurrentCollection;
            groupedList = definition.actions.list;
          },
        },
      },
    } as unknown as Plugin;
    new LogisticsWorkspaceActions(plugin, new NocoBaseWorkspaceReadModel(db)).register();
  });

  afterEach(async () => {
    await db.close();
  });

  function context(params: Record<string, unknown> = {}, permissions: Record<string, Permission | null> = {}) {
    return {
      db,
      state: {},
      get: () => '+00:00',
      can: ({ resource }: { resource: string }) => (resource in permissions ? permissions[resource] : {}),
      permission: { can: {} },
      action: {
        resourceName: 'logistics_work_items',
        actionName: 'list',
        params: { resourceName: 'logistics_work_items', paginate: false, ...params },
      },
      throw(status: number, message: string) {
        throw Object.assign(new Error(message), { status });
      },
    } as unknown as Context;
  }

  async function list(ctx: Context) {
    await authorize(ctx, () => actions.list(ctx, async () => undefined));
    return (ctx.body as Model[]).map((row) => row.toJSON());
  }

  async function find(ctx: Context) {
    ctx.action.actionName = 'searchCurrentCollection';
    await authorize(ctx, () => search(ctx, async () => undefined));
    return (ctx.body as Model[]).map((row) => row.toJSON());
  }

  it('respects source row scopes and retains accessible runs without shipments', async () => {
    const rows = await list(
      context(
        {},
        {
          transport_runs: { params: { filter: { run_number: 30 } } },
          shipments: { params: { filter: { status: 'queue' } } },
        },
      ),
    );
    expect(rows.map((row) => row.id).sort()).toEqual(['10:0', '10:100']);
  });

  it('does not return hidden source fields or appended source records', async () => {
    const rows = await list(
      context(
        { appends: ['run', 'shipment'] },
        {
          transport_runs: { params: { fields: ['run_number', 'registration_number_input'] } },
          shipments: { params: { fields: ['shipment_number'] } },
        },
      ),
    );
    expect(rows[0]).toMatchObject({ run_number: 30 });
    expect(rows[0]).not.toHaveProperty('manager_comment');
    expect(rows[0]).not.toHaveProperty('run');
    expect(rows[0]).not.toHaveProperty('shipment');
    const selected = await list(context({ fields: ['run_number'] }));
    expect(Object.keys(selected[0]).sort()).toEqual(['id', 'run_number']);
  });

  it('denies access without source permissions and denies writes even to a privileged caller', async () => {
    await expect(list(context({}, { shipments: null }))).rejects.toMatchObject({ status: 403 });
    const ctx = context();
    ctx.action.actionName = 'update';
    await expect(authorize(ctx, async () => undefined)).rejects.toMatchObject({ status: 403 });
  });

  it('searches current values while preserving filters and sees subsequent updates', async () => {
    expect((await find(context({ searchTerm: 'AB123', filter: { run_number: 30 } }))).map((row) => row.id)).toEqual([
      '10:100',
      '10:101',
    ]);
    await db
      .getRepository('logistics_work_items')
      .update({ filterByTk: '10:100', values: { registration_number: 'NEW999' } });
    expect((await find(context({ searchTerm: 'NEW999' }))).map((row) => row.id)).toEqual(['10:100']);
    expect((await find(context({ searchTerm: 'AB123' }))).map((row) => row.id)).toEqual(['10:101']);
    expect(
      (await find(context({ searchTerm: '100', searchFields: ['shipment_number'] }))).map((row) => row.id),
    ).toEqual(['10:100']);
    expect(
      (await find(context({ searchTerm: '№100', searchFields: ['shipment_number'] }))).map((row) => row.id),
    ).toEqual(['10:100']);
  });

  it('does not search, filter or sort by inaccessible fields', async () => {
    const permissions = { shipments: { params: { fields: ['shipment_number'] } } };
    await expect(
      find(context({ searchTerm: 'Скрытая', searchFields: ['manager_comment'] }, permissions)),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      list(context({ filter: { manager_comment: { $includes: 'Скрытая' } } }, permissions)),
    ).rejects.toMatchObject({ status: 403 });
    await expect(list(context({ sort: ['manager_comment'] }, permissions))).rejects.toMatchObject({ status: 403 });
    await expect(list(context({ sort: '-manager_comment' }, permissions))).rejects.toMatchObject({ status: 403 });
  });

  it('searches Russian status labels and respects the selected search fields', async () => {
    expect(
      (await find(context({ searchTerm: 'очеред', searchFields: ['status'] }))).map((row) => row.id).sort(),
    ).toEqual(['10:100', '11:100']);
    expect((await find(context({ searchTerm: 'Выпуск', searchFields: ['status'] }))).map((row) => row.id)).toEqual([
      '10:101',
    ]);
    expect(await find(context({ searchTerm: 'Выпуск', searchFields: ['registration_number'] }))).toEqual([]);
    await expect(
      find(
        context(
          { searchTerm: 'Выпуск', searchFields: ['status'] },
          { shipments: { params: { fields: ['shipment_number'] } } },
        ),
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('searches Russian transport labels and respects field permissions', async () => {
    expect(
      (await find(context({ searchTerm: 'Автомобиль', searchFields: ['transport_type'] }))).map((row) => row.id),
    ).toEqual(['10:100']);
    expect(
      (await find(context({ searchTerm: 'Морская', searchFields: ['transport_type'] }))).map((row) => row.id),
    ).toEqual(['11:100']);
    await expect(
      find(
        context(
          { searchTerm: 'Морская', searchFields: ['transport_type'] },
          { transport_runs: { params: { fields: ['run_number'] } } },
        ),
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('validates search and filter input and returns an empty result for a missing value', async () => {
    for (const searchTerm of ['', 'ab', 'x'.repeat(101), 123]) {
      await expect(find(context({ searchTerm }))).rejects.toMatchObject({ status: 400 });
    }
    await expect(find(context({ searchTerm: 'ABC', searchFields: '[invalid' }))).rejects.toMatchObject({ status: 400 });
    await expect(list(context({ filter: '[invalid' }))).rejects.toMatchObject({ status: 400 });
    expect(await find(context({ searchTerm: "';DROP TABLE shipments;--" }))).toEqual([]);
    expect(await db.getRepository('shipments').count()).toBe(2);
  });

  it('paginates whole runs and reports a shared shipment once in the global count', async () => {
    const queries = vi.spyOn(db.sequelize, 'query');
    const ctx = context({ workspaceGroupByRun: true, pageSize: 1, page: 1, sort: ['run_number'] });
    await authorize(ctx, () => groupedList(ctx, async () => undefined));
    expect(ctx.body).toMatchObject({ count: 2, page: 1, pageSize: 1, totalPage: 2 });
    const result = ctx.body as {
      rows: { id: string }[];
      workspace: {
        shipmentCount: number;
        shipmentRuns: Record<string, { id: string }[]>;
        runTotals: Record<string, number>;
      };
    };
    expect(result.rows.map((row) => row.id).sort()).toEqual(['10:0', '10:100', '10:101']);
    expect(result.workspace.shipmentCount).toBe(2);
    expect(result.workspace.runTotals['10']).toBe(2);
    expect(result.workspace.shipmentRuns['100'].map((run) => run.id).sort()).toEqual(['10', '11']);
    const paginationQuery = queries.mock.calls
      .map(([sql]) => (typeof sql === 'string' ? sql : ''))
      .find((sql) => /GROUP BY[\s\S]*LIMIT/i.test(sql));
    expect(paginationQuery).toBeDefined();
    // SQLite tolerates an ungrouped primary key in ORDER BY; PostgreSQL rejects it.
    expect(paginationQuery?.match(/ORDER BY([\s\S]*?)LIMIT/i)?.[1]).not.toMatch(/["`]id["`]/);
    queries.mockRestore();
  });

  it('keeps source scopes and field restrictions in grouped rows and link badges', async () => {
    const ctx = context(
      { workspaceGroupByRun: true, pageSize: 1, filter: { status: 'queue' } },
      {
        transport_runs: { params: { fields: ['run_number'], filter: { run_number: 30 } } },
        shipments: { params: { fields: ['shipment_number', 'status'] } },
      },
    );
    await authorize(ctx, () => groupedList(ctx, async () => undefined));
    expect(ctx.body).toMatchObject({ count: 1, workspace: { shipmentCount: 1, runTotals: { '10': 2 } } });
    const result = ctx.body as { rows: object[]; workspace: { shipmentRuns: Record<string, object[]> } };
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).not.toHaveProperty('registration_number');
    expect(result.workspace.shipmentRuns['100']).toEqual([{ id: '10', run_number: 30 }]);
  });

  it('validates group pagination and returns an empty page for an unmatched filter', async () => {
    for (const params of [{ page: 0 }, { page: 1.5 }, { pageSize: 201 }, { pageSize: 'invalid' }]) {
      const ctx = context({ workspaceGroupByRun: true, ...params });
      await expect(authorize(ctx, () => groupedList(ctx, async () => undefined))).rejects.toMatchObject({
        status: 400,
      });
    }
    const ctx = context({ workspaceGroupByRun: true, filter: { run_number: 999 } });
    await authorize(ctx, () => groupedList(ctx, async () => undefined));
    expect(ctx.body).toMatchObject({ count: 0, rows: [], workspace: { shipmentCount: 0 } });
  });

  it('includes links for shipments omitted by the current filter so the run overview remains complete', async () => {
    const ctx = context({ workspaceGroupByRun: true, filter: { status: 'release' } });
    await authorize(ctx, () => groupedList(ctx, async () => undefined));
    expect(ctx.body).toMatchObject({ count: 1, workspace: { shipmentCount: 1, runTotals: { '10': 2 } } });
    const result = ctx.body as { workspace: { shipmentRuns: Record<string, { id: string }[]> } };
    expect(result.workspace.shipmentRuns['100'].map((run) => run.id).sort()).toEqual(['10', '11']);
  });
});
