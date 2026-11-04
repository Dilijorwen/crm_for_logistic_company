/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createMockDatabase, type Database } from '@nocobase/database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { removeShipmentFields } from '../RemoveShipmentFields';
import { ARCHIVED_SHIPMENT_FIELDS } from '../SimplifyShipmentFields';
import shipments from '../../../collections/shipments';
import workItems from '../../../collections/logisticsWorkItems';

const { viewSql } = vi.hoisted(() => ({
  viewSql: 'CREATE VIEW logistics_work_items AS SELECT id, invoice_number FROM shipments',
}));
vi.mock('../../read-model/LogisticsWorkspaceViewSql', () => ({ LOGISTICS_WORKSPACE_VIEW_SQL: viewSql }));

describe('physical removal of retired shipment fields', () => {
  let db: Database;

  beforeEach(async () => {
    db = await createMockDatabase({ dialect: 'sqlite', storage: ':memory:' });
    db.collection({
      name: 'shipments',
      indexes: [{ name: 'shipments_route_delivery_number_idx', fields: ['route_delivery_number'] }],
      fields: [
        { name: 'invoice_number', type: 'string' },
        { name: 'route_delivery_number', type: 'string' },
        { name: 'declaration_release_date', type: 'dateOnly' },
        { name: 'application_release_date', type: 'dateOnly' },
      ],
    });
    db.collection({
      name: 'logistics_work_items',
      view: true,
      timestamps: false,
      fields: [
        { name: 'invoice_number', type: 'string' },
        ...[...ARCHIVED_SHIPMENT_FIELDS].map((name) => ({ name, type: 'string' })),
      ],
    });
    db.collection({
      name: 'fields',
      fields: [
        { name: 'collectionName', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'options', type: 'json' },
      ],
    });
    db.collection({
      name: 'collections',
      fields: [
        { name: 'name', type: 'string' },
        { name: 'options', type: 'json' },
      ],
    });
    db.collection({
      name: 'dataSourcesRolesResources',
      fields: [
        { name: 'name', type: 'string' },
        { name: 'dataSourceKey', type: 'string' },
      ],
    });
    db.collection({
      name: 'dataSourcesRolesResourcesActions',
      fields: [
        { name: 'rolesResourceId', type: 'integer' },
        { name: 'fields', type: 'json' },
      ],
    });
    await db.sync();
    await db.sequelize.query(
      'CREATE VIEW logistics_work_items AS SELECT id, invoice_number, route_delivery_number, declaration_release_date, application_release_date FROM shipments',
    );
    await db.getRepository('shipments').create({
      values: {
        id: 1,
        invoice_number: 'INV-1',
        route_delivery_number: 'DEL-1',
        declaration_release_date: '2026-01-01',
      },
    });
    await db.getRepository('fields').create({
      values: ['shipments', 'logistics_work_items', 'unrelated'].flatMap((collectionName) =>
        [...ARCHIVED_SHIPMENT_FIELDS, 'invoice_number'].map((name) => ({ collectionName, name, options: {} })),
      ),
    });
    await db.getRepository('collections').create({
      values: {
        name: 'shipments',
        options: {
          indexes: [
            { name: 'old', fields: ['route_delivery_number'] },
            { name: 'invoice', fields: ['invoice_number'] },
          ],
        },
      },
    });
    await db
      .getRepository('dataSourcesRolesResources')
      .create({ values: { id: 1, name: 'shipments', dataSourceKey: 'main' } });
    await db.getRepository('dataSourcesRolesResourcesActions').create({
      values: { rolesResourceId: 1, fields: ['id', 'invoice_number', ...ARCHIVED_SHIPMENT_FIELDS] },
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.close();
  });

  it('drops the columns, their metadata and index without removing shipment rows, and can run twice', async () => {
    await removeShipmentFields(db);
    await removeShipmentFields(db);
    const columns = await db.sequelize.getQueryInterface().describeTable('shipments');
    for (const name of ARCHIVED_SHIPMENT_FIELDS) {
      expect(columns).not.toHaveProperty(name);
      expect(db.getCollection('shipments').hasField(name)).toBe(false);
      expect(db.getCollection('logistics_work_items').hasField(name)).toBe(false);
      expect(shipments.fields?.some((field) => field.name === name)).toBe(false);
      expect(workItems.fields?.some((field) => field.name === name)).toBe(false);
    }
    expect((await db.getRepository('shipments').findOne({ filterByTk: 1 })).get('invoice_number')).toBe('INV-1');
    const [rows] = await db.sequelize.query('SELECT * FROM logistics_work_items');
    expect(rows).toEqual([{ id: 1, invoice_number: 'INV-1' }]);
    expect(await db.getRepository('fields').count({ filter: { collectionName: 'shipments' } })).toBe(1);
    expect(await db.getRepository('fields').count({ filter: { collectionName: 'unrelated' } })).toBe(4);
    expect((await db.getRepository('dataSourcesRolesResourcesActions').findOne()).get('fields')).toEqual([
      'id',
      'invoice_number',
    ]);
    expect((await db.getRepository('collections').findOne()).get('options')).toEqual({
      indexes: [{ name: 'invoice', fields: ['invoice_number'] }],
    });
    expect(shipments.indexes?.some((index) => index.name === 'shipments_route_delivery_number_idx')).toBe(false);
  });

  it('rolls back column deletion, metadata and permissions if rebuilding the view fails', async () => {
    const query = db.sequelize.query.bind(db.sequelize);
    vi.spyOn(db.sequelize, 'query').mockImplementation((sql, options) => {
      if (sql === viewSql) return Promise.reject(new Error('View rebuild failed'));
      return query(sql, options);
    });
    await expect(removeShipmentFields(db)).rejects.toThrow('View rebuild failed');
    const columns = await db.sequelize.getQueryInterface().describeTable('shipments');
    for (const name of ARCHIVED_SHIPMENT_FIELDS) expect(columns).toHaveProperty(name);
    const [rows] = await db.sequelize.query('SELECT route_delivery_number FROM logistics_work_items');
    expect(rows).toEqual([{ route_delivery_number: 'DEL-1' }]);
    expect(await db.getRepository('fields').count({ filter: { collectionName: 'shipments' } })).toBe(4);
    expect((await db.getRepository('dataSourcesRolesResourcesActions').findOne()).get('fields')).toContain(
      'route_delivery_number',
    );
  });
});
