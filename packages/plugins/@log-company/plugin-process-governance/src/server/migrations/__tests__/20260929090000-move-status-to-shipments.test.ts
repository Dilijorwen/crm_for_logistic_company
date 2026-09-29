/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import MoveStatusToShipments from '../20260929090000-move-status-to-shipments';

type MigrationContext = ConstructorParameters<typeof MoveStatusToShipments>[0];

function setup(statusExists: boolean) {
  const queryInterface = {
    describeTable: vi.fn(async () => (statusExists ? { status: {} } : {})),
    addColumn: vi.fn(async () => undefined),
    changeColumn: vi.fn(async () => undefined),
  };
  const query = vi.fn(async () => undefined);
  const update = vi.fn(async () => undefined);
  const fields = {
    findOne: vi.fn(async () => (statusExists ? { update } : null)),
    create: vi.fn(async () => undefined),
    destroy: vi.fn(async () => undefined),
  };
  const removeField = vi.fn();
  const database = {
    sequelize: { getQueryInterface: () => queryInterface, query },
    getRepository: () => fields,
    getCollection: () => ({ removeField }),
  };
  const migration = new MoveStatusToShipments({ db: database } as unknown as MigrationContext);
  return { fields, migration, query, queryInterface, removeField, update };
}

describe('move status from runs to shipments migration', () => {
  it('adds, backfills and registers the shipment status before removing run metadata', async () => {
    const { fields, migration, query, queryInterface, removeField } = setup(false);

    await migration.up();

    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      'shipments',
      'status',
      expect.objectContaining({ allowNull: true }),
    );
    expect(query.mock.calls[0][0]).toContain('from transport_run_shipments link');
    expect(query.mock.calls[0][0]).toContain('order by run."updatedAt" desc');
    expect(queryInterface.changeColumn).toHaveBeenCalledWith(
      'shipments',
      'status',
      expect.objectContaining({ allowNull: false, defaultValue: 'queue' }),
    );
    expect(fields.create).toHaveBeenCalledWith({
      values: expect.objectContaining({ collectionName: 'shipments', name: 'status', defaultValue: 'queue' }),
    });
    expect(fields.destroy).toHaveBeenCalledWith({
      filter: { collectionName: 'transport_runs', name: 'status' },
    });
    expect(removeField).toHaveBeenCalledWith('status');
    expect(query.mock.calls[3][0]).toContain('not exists');
    expect(query.mock.calls[4][0]).toContain('shipment_resource."roleName" = run_resource."roleName"');
  });

  it('is idempotent when the physical and metadata shipment fields already exist', async () => {
    const { fields, migration, queryInterface, update } = setup(true);

    await migration.up();

    expect(queryInterface.addColumn).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      type: 'string',
      interface: 'select',
      options: expect.objectContaining({ defaultValue: 'queue' }),
    });
    expect(fields.create).not.toHaveBeenCalled();
  });
});
