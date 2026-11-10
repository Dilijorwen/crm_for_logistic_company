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
import { SHIPMENT_CUSTOMS_FIELD_LABELS } from '../../../shared/logistics';
import shipments from '../../collections/shipments';
import {
  assignWorkspaceParents,
  type WorkspaceFlowTree,
} from '../../infrastructure/metadata/LogisticsWorkspaceNativeModels';
import { LOGISTICS_WORKSPACE_VIEW_SQL } from '../../infrastructure/read-model/LogisticsWorkspaceViewSql';
import SplitShipmentCheckDeadlines from '../20261110010000-split-shipment-check-deadlines';

const tenDays = 'additional_check_response_deadline';
const sixtyDays = 'additional_check_response_deadline_60_days';
const run = process.env.DB_DIALECT === 'postgres' && process.env.DB_DATABASE === 'logistics_deadlines_test';

describe.runIf(run)('shipment check deadlines upgrade', () => {
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
      fields: shipments.fields?.filter((field) => !field.target && field.name !== sixtyDays),
    });
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
      CREATE TABLE chinese_clients (id bigint PRIMARY KEY, name text);
      CREATE TABLE our_companies (id bigint PRIMARY KEY, name text);
      CREATE TABLE contracts (id bigint PRIMARY KEY, name text);
      CREATE TABLE customs_warehouses (id bigint PRIMARY KEY, name text);
      INSERT INTO vehicles VALUES (1, 'TEST');
      INSERT INTO transport_runs (id, run_number, vehicle_id) VALUES (1, 1, 1);
      INSERT INTO shipments (id, shipment_number, status, chinese_client_id, company_id, ktc_amount, ${tenDays})
        VALUES (1, 1, 'queue', 1, 1, 123.45, '2026-11-20');
      INSERT INTO transport_run_shipments VALUES (1, 1);
    `);
    await db.sequelize.query(LOGISTICS_WORKSPACE_VIEW_SQL);
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

  it('keeps the old date and amount, exposes an independent date and preserves existing form and access settings', async () => {
    const fields = db.getRepository('fields');
    const resources = db.getRepository('dataSourcesRolesResources');
    const actions = db.getRepository('dataSourcesRolesResourcesActions');
    for (const collectionName of ['shipments', 'logistics_work_items']) {
      await fields.create({
        values: {
          key: `${collectionName}_amount`,
          collectionName,
          name: 'ktc_amount',
          type: 'double',
          options: { uiSchema: { title: 'Сумма КТС', 'x-component-props': { step: '0.01' } } },
        },
      });
      await fields.create({
        values: {
          key: `${collectionName}_deadline`,
          collectionName,
          name: tenDays,
          type: 'dateOnly',
          options: { uiSchema: { title: 'Срок ответа по дополнительной проверке' } },
        },
      });
    }
    const grid: WorkspaceFlowTree = {
      uid: 'shipment-grid',
      use: 'FormGridModel',
      stepParams: { gridSettings: { grid: { rows: { date: [['old-deadline']] } } } },
      subModels: {
        items: [
          {
            uid: 'old-deadline',
            use: 'FormItemModel',
            props: { label: 'Срок ответа' },
            stepParams: {
              fieldSettings: { init: { dataSourceKey: 'main', collectionName: 'shipments', fieldPath: tenDays } },
            },
            subModels: { field: { uid: 'old-date-input', use: 'DateOnlyFieldModel' } },
          },
        ],
      },
    };
    assignWorkspaceParents(grid);
    await models.upsertModel(grid);
    await models.upsertModel({
      uid: 'amount-column',
      use: 'TableColumnModel',
      props: { title: 'Сумма КТС', width: 160 },
      stepParams: { fieldSettings: { init: { collectionName: 'logistics_work_items', fieldPath: 'ktc_amount' } } },
    });
    const main = await resources.create({ values: { name: 'shipments', dataSourceKey: 'main' } });
    const external = await resources.create({ values: { name: 'shipments', dataSourceKey: 'external' } });
    const allowed = await actions.create({
      values: { rolesResourceId: main.get('id'), fields: [tenDays, 'ktc_amount'] },
    });
    const restricted = await actions.create({ values: { rolesResourceId: main.get('id'), fields: ['ktc_amount'] } });
    const externalAction = await actions.create({ values: { rolesResourceId: external.get('id'), fields: [tenDays] } });
    const migration = new SplitShipmentCheckDeadlines({
      db,
      queryInterface: db.sequelize.getQueryInterface(),
      sequelize: db.sequelize,
    });
    const selectDates = `SELECT ktc_amount, ${tenDays}, ${sixtyDays} FROM logistics_work_items WHERE ${tenDays} = '2026-11-20'`;

    await migration.up();
    const [before] = await db.sequelize.query(selectDates);
    expect(before).toEqual([{ ktc_amount: 123.45, [tenDays]: '2026-11-20', [sixtyDays]: null }]);
    await db.sequelize.query(`UPDATE shipments SET ${sixtyDays} = '2027-01-10' WHERE id = 1`);
    await migration.up();
    const [after] = await db.sequelize.query(selectDates);
    expect(after).toEqual([{ ktc_amount: 123.45, [tenDays]: '2026-11-20', [sixtyDays]: '2027-01-10' }]);

    for (const collectionName of ['shipments', 'logistics_work_items']) {
      for (const [name, title] of Object.entries(SHIPMENT_CUSTOMS_FIELD_LABELS)) {
        const field = await fields.findOne({ filter: { collectionName, name } });
        expect(field.get('options')).toMatchObject({ uiSchema: { title } });
      }
    }
    expect(new Set((await allowed.reload()).get('fields'))).toEqual(new Set([tenDays, 'ktc_amount', sixtyDays]));
    expect((await restricted.reload()).get('fields')).toEqual(['ktc_amount']);
    expect((await externalAction.reload()).get('fields')).toEqual([tenDays]);
    const savedGrid = await models.findModelById(grid.uid);
    expect(savedGrid.stepParams).toEqual(grid.stepParams);
    expect(savedGrid.subModels.items).toHaveLength(2);
    expect(savedGrid.subModels.items[0]).toMatchObject({
      uid: 'old-deadline',
      props: { label: SHIPMENT_CUSTOMS_FIELD_LABELS[tenDays] },
    });
    expect(savedGrid.subModels.items[1]).toMatchObject({
      stepParams: { fieldSettings: { init: { fieldPath: sixtyDays } } },
      subModels: { field: { use: 'DateOnlyFieldModel' } },
    });
    const column = await models.findModelById('amount-column');
    expect(column.props).toEqual({ title: 'Сумма обеспечения', width: 160 });
  });
});
