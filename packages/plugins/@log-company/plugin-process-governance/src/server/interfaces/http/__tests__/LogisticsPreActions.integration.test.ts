/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createMockDatabase, type Database } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidateRunParents } from '../../../application/logistics/ValidateRunParents';
import { ValidateShipmentDeletion } from '../../../application/logistics/ValidateShipmentDeletion';
import type { LogisticsRepository } from '../../../application/logistics/ports/LogisticsRepository';
import { LogisticsPreActions } from '../LogisticsPreActions';

type PreActionHandler = (
  context: {
    action: {
      actionName: string;
      params: Record<string, unknown>;
    };
  },
  next: () => Promise<unknown>,
) => Promise<void>;

describe('LogisticsPreActions database integration', () => {
  let db: Database;

  beforeEach(async () => {
    db = await createMockDatabase();
    await db.clean({ drop: true });
    db.collection({ name: 'transport_run_shipments', timestamps: false });
    db.collection({
      name: 'shipments',
      fields: [{ type: 'string', name: 'display_name' }],
    });
    db.collection({
      name: 'transport_runs',
      fields: [
        {
          type: 'belongsToMany',
          name: 'shipments',
          target: 'shipments',
          through: 'transport_run_shipments',
          foreignKey: 'transport_run_id',
          otherKey: 'shipment_id',
        },
      ],
    });
    await db.sync();
  });

  afterEach(async () => {
    await db.close();
  });

  it('keeps the current shipment values while saving a run with a stale shipment snapshot', async () => {
    const handlers = new Map<string, PreActionHandler>();
    const plugin = {
      app: {
        resourcer: {
          registerPreActionHandler: (name: string, handler: PreActionHandler) => handlers.set(name, handler),
        },
      },
    } as unknown as Plugin;
    const repository = {
      getRunParentIds: vi.fn(async () => []),
      lockRunParentGraph: vi.fn(async () => undefined),
      runParentSelectionCreatesCycle: vi.fn(async () => false),
      countShipmentRunLinks: vi.fn(async () => 0),
    } as unknown as LogisticsRepository;
    new LogisticsPreActions(
      plugin,
      repository,
      new ValidateRunParents(repository),
      new ValidateShipmentDeletion(repository),
    ).register();

    const run = await db.getRepository('transport_runs').create({ values: {} });
    const shipment = await db.getRepository('shipments').create({ values: { display_name: 'Актуальное название' } });
    const params: Record<string, unknown> = {
      filterByTk: run.get('id'),
      values: {
        shipments: [{ id: shipment.get('id'), display_name: 'Устаревшее название' }],
      },
      updateAssociationValues: ['shipments'],
    };
    const handler = handlers.get('transport_runs:update');
    if (!handler) {
      throw new Error('transport_runs:update pre-action was not registered');
    }

    await handler({ action: { actionName: 'update', params } }, async () => {
      await db.getRepository('transport_runs').update(params);
    });

    const persistedShipment = await db.getRepository('shipments').findOne({ filterByTk: shipment.get('id') });
    const linkedShipments = await db.getRepository('transport_runs.shipments', run.get('id')).find();
    expect(persistedShipment?.get('display_name')).toBe('Актуальное название');
    expect(linkedShipments.map((record) => record.get('id'))).toEqual([shipment.get('id')]);
  });
});
