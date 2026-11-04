/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Context } from '@nocobase/actions';
import { createMockDatabase, type Database } from '@nocobase/database';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DeleteWorkspaceShipments } from '../../../../application/logistics/DeleteWorkspaceShipments';
import { NocoBaseWorkspaceDeletion } from '../NocoBaseWorkspaceDeletion';

describe('workspace deletion transaction with real repositories', () => {
  let db: Database;
  beforeEach(async () => {
    db = await createMockDatabase({ dialect: 'sqlite', storage: ':memory:' });
    db.collection({
      name: 'transport_runs',
      fields: [
        {
          name: 'shipments',
          type: 'belongsToMany',
          target: 'shipments',
          through: 'transport_run_shipments',
          foreignKey: 'transport_run_id',
          otherKey: 'shipment_id',
          onDelete: 'CASCADE',
        },
      ],
    });
    db.collection({
      name: 'shipments',
      fields: [
        {
          name: 'runs',
          type: 'belongsToMany',
          target: 'transport_runs',
          through: 'transport_run_shipments',
          foreignKey: 'shipment_id',
          otherKey: 'transport_run_id',
          onDelete: 'CASCADE',
        },
      ],
    });
    db.collection({
      name: 'logistics_work_items',
      autoGenId: false,
      fields: [{ name: 'id', type: 'string', primaryKey: true }],
    });
    await db.sync();
    await db.getRepository('shipments').create({ values: [{ id: 100 }, { id: 101 }] });
    await db.getRepository('transport_runs').create({
      values: [
        { id: 10, shipments: [100, 101] },
        { id: 11, shipments: [100] },
      ],
    });
    await db
      .getRepository('logistics_work_items')
      .create({ values: [{ id: '10:100' }, { id: '10:101' }, { id: '11:100' }] });
  });
  afterEach(async () => {
    await db.close();
  });

  function deletion(denied?: string, filter?: Record<string, unknown>) {
    const context = {
      state: {},
      get: () => '+00:00',
      can: ({ resource, action }: { resource: string; action: string }) =>
        `${resource}:${action}` === denied ? null : { params: { filter } },
    } as unknown as Context;
    return new DeleteWorkspaceShipments(new NocoBaseWorkspaceDeletion(db, context));
  }

  it('removes a shipment from all runs and deletes only the run that becomes empty', async () => {
    const hookIds: string[] = [];
    db.on('shipments.beforeDestroy', async (model, options) => {
      expect(
        await db
          .getRepository('transport_run_shipments')
          .count({ filter: { shipment_id: model.get('id') }, transaction: options.transaction }),
      ).toBe(0);
      hookIds.push(String(model.get('id')));
    });
    expect(await deletion().execute(['10:100', '11:100', '10:100'])).toEqual({
      shipments: 1,
      runs: 1,
      shipmentIds: ['100'],
      runIds: ['11'],
    });
    expect(await db.getRepository('transport_runs').count()).toBe(1);
    expect(await db.getRepository('transport_runs').findById(10)).toBeTruthy();
    expect(await db.getRepository('shipments').count()).toBe(1);
    expect(await db.getRepository('transport_run_shipments').count()).toBe(1);
    expect(hookIds).toEqual(['100']);
  });

  it('deletes every emptied run when the entire selection is removed', async () => {
    expect(await deletion().execute(['10:100', '10:101'])).toEqual({
      shipments: 2,
      runs: 2,
      shipmentIds: ['100', '101'],
      runIds: ['10', '11'],
    });
    expect(await db.getRepository('transport_runs').count()).toBe(0);
    expect(await db.getRepository('shipments').count()).toBe(0);
  });

  it('preserves every source row and link when run deletion is forbidden', async () => {
    await expect(deletion('transport_runs:destroy').execute(['10:100'])).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await db.getRepository('shipments').count()).toBe(2);
    expect(await db.getRepository('transport_run_shipments').count()).toBe(3);
  });

  it('checks source scopes and rejects missing links', async () => {
    await expect(deletion(undefined, { id: 999 }).execute(['10:100'])).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(deletion().execute(['99:100'])).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await db.getRepository('transport_run_shipments').count()).toBe(3);
  });

  it('rolls back detached links and deleted shipments after a later source hook fails', async () => {
    db.on('transport_runs.beforeDestroy', () => {
      throw new Error('source failure');
    });
    await expect(deletion().execute(['10:100'])).rejects.toThrow('source failure');
    expect(await db.getRepository('transport_runs').count()).toBe(2);
    expect(await db.getRepository('shipments').count()).toBe(2);
    expect(await db.getRepository('transport_run_shipments').count()).toBe(3);
  });
});
