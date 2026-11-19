/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createMockDatabase, type Database } from '@nocobase/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import flowModels from '../../../../../../@nocobase/plugin-flow-engine/src/server/collections/flowModels';
import flowModelTreePath from '../../../../../../@nocobase/plugin-flow-engine/src/server/collections/flowModelTreePath';
import { FlowSchemaModel } from '../../../../../../@nocobase/plugin-flow-engine/src/server/model';
import FlowModelRepository from '../../../../../../@nocobase/plugin-flow-engine/src/server/repository';
import shipments from '../../collections/shipments';
import shipmentChineseClients from '../../collections/shipmentChineseClients';
import { LOGISTICS_WORKSPACE_VIEW_WITH_60_DAY_DEADLINE_SQL } from '../../infrastructure/read-model/LogisticsWorkspaceViewSql';
import MultipleShipmentChineseClients from '../20261111010000-multiple-shipment-chinese-clients';

const run = process.env.DB_DIALECT === 'postgres' && process.env.DB_DATABASE === 'logistics_clients_test';
describe.runIf(run)('multiple shipment clients upgrade', () => {
  let db: Database;
  let models: FlowModelRepository;
  beforeAll(async () => {
    db = await createMockDatabase();
    db.registerModels({ FlowSchemaModel });
    db.registerRepositories({ FlowModelRepository });
    db.collection(flowModels);
    db.collection(flowModelTreePath);
    db.collection({
      name: 'fields',
      autoGenId: false,
      fields: [
        { type: 'uid', name: 'key', primaryKey: true, allowNull: false },
        { type: 'string', name: 'collectionName' },
        { type: 'string', name: 'name' },
        { type: 'string', name: 'type' },
        { type: 'string', name: 'interface' },
        { type: 'json', name: 'options' },
      ],
    });
    db.collection({
      name: 'dataSourcesRolesResources',
      fields: [
        { type: 'string', name: 'dataSourceKey' },
        { type: 'string', name: 'name' },
      ],
    });
    db.collection({
      name: 'dataSourcesRolesResourcesActions',
      fields: [
        { type: 'bigInt', name: 'rolesResourceId' },
        { type: 'array', name: 'fields' },
      ],
    });
    db.collection({
      name: 'shipments',
      autoGenId: false,
      timestamps: false,
      fields: shipments.fields?.filter((field) => !field.target),
    });
    db.collection(shipmentChineseClients);
    await db.sync();
    models = db.getRepository('flowModels') as FlowModelRepository;
    await db.sequelize.query(`
      CREATE TABLE transport_runs (id bigint PRIMARY KEY, run_number integer, vehicle_id bigint, departure_city_id bigint, transport_type text);
      CREATE TABLE vehicles (id bigint PRIMARY KEY, registration_number text);
      CREATE TABLE transport_run_shipments (transport_run_id bigint, shipment_id bigint);
      CREATE TABLE transport_run_managers (transport_run_id bigint, user_id bigint);
      CREATE TABLE transport_run_declarants (transport_run_id bigint, user_id bigint);
      CREATE TABLE users (id bigint PRIMARY KEY, nickname text, username text);
      CREATE TABLE departure_cities (id bigint PRIMARY KEY, name text);
      CREATE TABLE chinese_clients (id bigint PRIMARY KEY, name varchar(255));
      CREATE TABLE our_companies (id bigint PRIMARY KEY, name text);
      CREATE TABLE contracts (id bigint PRIMARY KEY, name text);
      CREATE TABLE customs_warehouses (id bigint PRIMARY KEY, name text);
      INSERT INTO chinese_clients VALUES (1, 'Клиент А'), (2, 'Клиент Б');
      INSERT INTO vehicles VALUES (1, 'TEST');
      INSERT INTO transport_runs (id, run_number, vehicle_id) VALUES (1, 1, 1);
      INSERT INTO shipments (id, shipment_number, status, chinese_client_id, company_id, ktc_amount, additional_check_response_deadline)
        VALUES (1, 1, 'queue', 1, 1, 123.45, '2026-11-20');
      INSERT INTO transport_run_shipments VALUES (1, 1);
    `);
    await db.sequelize.query(LOGISTICS_WORKSPACE_VIEW_WITH_60_DAY_DEADLINE_SQL);
  });

  afterAll(async () => {
    if (!db) return;
    try {
      await db.sequelize.query('DROP VIEW IF EXISTS public.logistics_work_items');
      await db.clean({ drop: true });
    } finally {
      await db.close();
    }
  });

  it('migrates single clients, retains model identities and supports several names without duplicating shipment rows', async () => {
    const fields = db.getRepository('fields');
    for (const [collectionName, name, type] of [
      ['shipments', 'chinese_client', 'belongsTo'],
      ['chinese_clients', 'shipments', 'hasMany'],
      ['logistics_work_items', 'chinese_client_name', 'string'],
    ]) {
      await fields.create({
        values: {
          key: `${collectionName}_${name}`,
          collectionName,
          name,
          type,
          options: {
            foreignKey: 'chinese_client_id',
            uiSchema: { title: 'Китайский клиент', 'x-component-props': { multiple: false } },
          },
        },
      });
    }
    await models.upsertModel({
      uid: 'client-item',
      use: 'FormItemModel',
      stepParams: { fieldSettings: { init: { collectionName: 'shipments', fieldPath: 'chinese_client' } } },
      subModels: {
        field: {
          uid: 'client-input',
          use: 'RecordSelectFieldModel',
          parentId: 'client-item',
          subKey: 'field',
          subType: 'object',
          stepParams: { selectSettings: { allowMultiple: { allowMultiple: false } } },
        },
      },
    });
    const migration = new MultipleShipmentChineseClients({
      db,
      queryInterface: db.sequelize.getQueryInterface(),
      sequelize: db.sequelize,
    });
    await migration.up();
    expect(
      (await db.sequelize.query('SELECT shipment_id, chinese_client_id FROM shipment_chinese_clients'))[0],
    ).toEqual([{ shipment_id: 1, chinese_client_id: 1 }]);
    await db.sequelize.query('INSERT INTO shipment_chinese_clients (shipment_id, chinese_client_id) VALUES (1, 2)');
    await migration.up();
    const [rows] = await db.sequelize.query(
      'SELECT shipment_id, chinese_client_name, ktc_amount, additional_check_response_deadline FROM logistics_work_items',
    );
    expect(rows).toEqual([
      {
        shipment_id: 1,
        chinese_client_name: 'Клиент А, Клиент Б',
        ktc_amount: 123.45,
        additional_check_response_deadline: '2026-11-20',
      },
    ]);
    const association = await fields.findOne({ filter: { collectionName: 'shipments', name: 'chinese_client' } });
    expect(association.get('type')).toBe('belongsToMany');
    expect(association.get('options')).toMatchObject({
      through: 'shipment_chinese_clients',
      uiSchema: { type: 'array', required: true, 'x-component-props': { multiple: true } },
    });
    const input = await models.findModelById('client-input');
    expect(input.stepParams.selectSettings.allowMultiple.allowMultiple).toBe(true);
    expect(input.props.multiple).toBe(true);
    await db.sequelize.query('DELETE FROM shipment_chinese_clients WHERE chinese_client_id = 1');
    await migration.up();
    expect((await db.sequelize.query('SELECT chinese_client_name FROM logistics_work_items'))[0]).toEqual([
      { chinese_client_name: 'Клиент Б' },
    ]);
    await expect(
      db.sequelize.query('INSERT INTO shipment_chinese_clients (shipment_id, chinese_client_id) VALUES (1, 2)'),
    ).rejects.toThrow();
    await expect(
      db.sequelize.query('INSERT INTO shipment_chinese_clients (shipment_id, chinese_client_id) VALUES (1, 999)'),
    ).rejects.toThrow();
  });
});
