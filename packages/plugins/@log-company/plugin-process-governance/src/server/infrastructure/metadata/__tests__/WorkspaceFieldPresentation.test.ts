/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createMockDatabase, type Database } from '@nocobase/database';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import shipments from '../../../collections/shipments';
import logisticsWorkItems from '../../../collections/logisticsWorkItems';
import { synchronizeWorkspaceFieldPresentation } from '../SynchronizeWorkspaceFieldPresentation';

describe('workspace field presentation from source metadata', () => {
  let db: Database;
  beforeEach(async () => {
    db = await createMockDatabase({ dialect: 'sqlite', storage: ':memory:' });
    db.collection({
      name: 'fields',
      fields: [
        { name: 'name', type: 'string' },
        { name: 'collectionName', type: 'string' },
        { name: 'interface', type: 'string' },
        { name: 'type', type: 'string' },
        { name: 'options', type: 'json' },
      ],
    });
    await db.sync();
  });
  afterEach(async () => {
    await db.close();
  });

  it('uses identical scalar semantics in the new projection and native shipment tables', () => {
    for (const target of logisticsWorkItems.fields || []) {
      const source = shipments.fields?.find((field) => field.name === target.name);
      if (!source || source.name === 'id') continue;
      expect(target.type, target.name).toBe(source.type);
      expect(target.interface, target.name).toBe(source.interface);
      expect(target.uiSchema?.['x-component'], target.name).toBe(source.uiSchema?.['x-component']);
      expect(target.uiSchema?.['x-component-props'], target.name).toEqual(source.uiSchema?.['x-component-props']);
      expect(target.uiSchema?.enum, target.name).toEqual(source.uiSchema?.enum);
    }
  });

  it('repairs decimal step and enum labels from stored source configuration, retaining target titles and options', async () => {
    const fields = db.getRepository('fields');
    for (const [name, sourceInterface, sourceUi] of [
      [
        'customs_payments_amount',
        'number',
        { type: 'number', 'x-component': 'InputNumber', 'x-component-props': { step: '0.0001', stringMode: true } },
      ],
      [
        'customs_scheme',
        'select',
        { type: 'string', 'x-component': 'Select', enum: [{ value: 'custom', label: 'Пользовательская схема' }] },
      ],
    ] as const) {
      await fields.create({
        values: {
          name,
          collectionName: 'shipments',
          type: 'double',
          interface: sourceInterface,
          options: { scale: 4, precision: 18, uiSchema: sourceUi },
        },
      });
      await fields.create({
        values: {
          name,
          collectionName: 'logistics_work_items',
          type: 'double',
          interface: 'input',
          options: { customOption: 'retained', uiSchema: { title: 'Мой заголовок', 'x-component': 'Input' } },
        },
      });
    }
    const sourceBefore = (await fields.find({ filter: { collectionName: 'shipments' } })).map((row) => row.toJSON());
    await db.sequelize.transaction(async (transaction) => {
      await synchronizeWorkspaceFieldPresentation(db, transaction);
      await synchronizeWorkspaceFieldPresentation(db, transaction);
    });
    for (const name of ['customs_payments_amount', 'customs_scheme']) {
      const source = await fields.findOne({ filter: { collectionName: 'shipments', name } });
      const target = await fields.findOne({ filter: { collectionName: 'logistics_work_items', name } });
      expect(target.get('interface')).toBe(source.get('interface'));
      expect(target.get('options')).toMatchObject({
        ...source.get('options'),
        customOption: 'retained',
        uiSchema: { ...source.get('options').uiSchema, title: 'Мой заголовок' },
      });
    }
    expect((await fields.find({ filter: { collectionName: 'shipments' } })).map((row) => row.toJSON())).toEqual(
      sourceBefore,
    );
  });

  it('leaves deliberately flattened associations and missing source fields unchanged', async () => {
    const fields = db.getRepository('fields');
    await fields.create({
      values: { name: 'chinese_client', collectionName: 'shipments', type: 'belongsTo', interface: 'm2o', options: {} },
    });
    const target = await fields.create({
      values: {
        name: 'chinese_client_name',
        collectionName: 'logistics_work_items',
        type: 'string',
        interface: 'input',
        options: { uiSchema: { title: 'Клиент' } },
      },
    });
    const before = target.toJSON();
    await db.sequelize.transaction((transaction) => synchronizeWorkspaceFieldPresentation(db, transaction));
    expect((await fields.findOne({ filter: { id: target.get('id') } })).toJSON()).toEqual(before);
  });
});
