/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createHash } from 'node:crypto';
import { createMockDatabase } from '@nocobase/database';
import type { Database } from '@nocobase/database';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import flowModels from '../../../../../../../@nocobase/plugin-flow-engine/src/server/collections/flowModels';
import flowModelTreePath from '../../../../../../../@nocobase/plugin-flow-engine/src/server/collections/flowModelTreePath';
import { FlowSchemaModel } from '../../../../../../../@nocobase/plugin-flow-engine/src/server/model';
import FlowModelRepository from '../../../../../../../@nocobase/plugin-flow-engine/src/server/repository';
import personalizations from '../../../../../../plugin-table-personalization/src/server/collections/tablePersonalizations';
import templates from '../../../../../../plugin-table-personalization/src/server/collections/tableFilterTemplates';
import shipments from '../../../collections/shipments';
import workItems from '../../../collections/logisticsWorkItems';
import { SHIPMENT_GENERAL, SHIPMENT_CUSTOMS, assignWorkspaceParents } from '../LogisticsWorkspaceNativeModels';
import type { WorkspaceFlowTree } from '../LogisticsWorkspaceNativeModels';
import { SHIPMENT_FORM_SECTIONS } from '../WorkspaceShipmentFormSections';
import { ARCHIVED_SHIPMENT_FIELDS, simplifyShipmentFields } from '../SimplifyShipmentFields';

describe('shipment field presentation upgrade', () => {
  let db: Database;
  let models: FlowModelRepository;
  beforeEach(async () => {
    db = await createMockDatabase({ dialect: 'sqlite', storage: ':memory:' });
    db.registerModels({ FlowSchemaModel });
    db.registerRepositories({ FlowModelRepository });
    db.collection(flowModels);
    db.collection(flowModelTreePath);
    db.collection(personalizations);
    db.collection(templates);
    db.collection({
      name: 'fields',
      fields: [
        { name: 'collectionName', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'options', type: 'json' },
      ],
    });
    db.collection({
      name: 'shipments',
      fields: [
        { name: 'route_delivery_number', type: 'string' },
        { name: 'declaration_release_date', type: 'dateOnly' },
        { name: 'application_release_date', type: 'dateOnly' },
      ],
    });
    await db.sync();
    models = db.getRepository('flowModels') as FlowModelRepository;
  });
  afterEach(async () => db.close());

  it('keeps retired fields out of current definitions and retains the НТМ section', () => {
    for (const collection of [shipments, workItems]) {
      for (const name of ARCHIVED_SHIPMENT_FIELDS) {
        expect(collection.fields?.find((field) => field.name === name)).toBeUndefined();
        expect([...SHIPMENT_GENERAL, ...SHIPMENT_CUSTOMS]).not.toContain(name);
      }
      for (const field of collection.fields || []) {
        if (field.name.startsWith('ntm_')) expect(field.uiSchema?.title).not.toMatch(/НТМ/u);
      }
    }
    expect(SHIPMENT_FORM_SECTIONS.map((section) => section.title)).toContain('НТМ');
  });

  async function seed() {
    async function save(tree: WorkspaceFlowTree) {
      assignWorkspaceParents(tree);
      await models.upsertModel(tree);
    }
    await save({
      uid: 'form',
      use: 'EditFormModel',
      stepParams: { resourceSettings: { init: { dataSourceKey: 'main', collectionName: 'shipments' } } },
      subModels: {
        grid: {
          uid: 'grid',
          use: 'FormGridModel',
          stepParams: {
            gridSettings: {
              grid: {
                rows: { first: [['delivery'], ['invoice']], second: [['date']], third: [['ntm']] },
                sizes: { first: [1, 3], second: [2], third: [4] },
              },
            },
          },
          subModels: {
            items: [
              ['delivery', 'route_delivery_number'],
              ['date', 'declaration_release_date'],
              ['invoice', 'invoice_number'],
              ['ntm', 'ntm_certificate_goods'],
            ].map(([uid, fieldPath]) => ({
              uid,
              use: 'FormItemModel',
              props: { label: fieldPath.startsWith('ntm_') ? 'Товары для сертификата НТМ' : fieldPath },
              stepParams: {
                fieldSettings: { init: { collectionName: 'shipments', fieldPath } },
                editItemSettings: { required: { required: true } },
              },
              subModels: { field: { uid: `${uid}input`, use: 'InputFieldModel' } },
            })),
          },
        },
      },
    });
    await save({
      uid: 'table',
      use: 'TableBlockModel',
      stepParams: { resourceSettings: { init: { collectionName: 'logistics_work_items' } } },
      props: { searchableFieldNames: ['invoice_number', 'route_delivery_number'] },
      subModels: {
        columns: [
          {
            uid: 'oldcolumn',
            use: 'TableColumnModel',
            stepParams: {
              fieldSettings: {
                init: { collectionName: 'logistics_work_items', fieldPath: 'application_release_date' },
              },
            },
          },
          {
            uid: 'ntmcolumn',
            use: 'TableColumnModel',
            props: { title: 'НТМ: СС/ДС', width: 175 },
            stepParams: {
              fieldSettings: { init: { collectionName: 'logistics_work_items', fieldPath: 'ntm_certificate_goods' } },
              tableColumnSettings: { title: { title: 'НТМ: СС/ДС' } },
            },
          },
        ],
      },
    });
    await save({ uid: 'category', use: 'FormGridModel', props: { workspaceSectionTitle: 'НТМ' } });
    await save({
      uid: 'unrelated',
      use: 'TableColumnModel',
      stepParams: { fieldSettings: { init: { collectionName: 'unrelated', fieldPath: 'route_delivery_number' } } },
    });
  }

  it('removes only bound elements, preserves other identities, validation, titles and closure paths', async () => {
    await seed();
    await models.upsertModel({
      uid: 'external',
      use: 'TableColumnModel',
      parentId: 'table',
      subKey: 'columns',
      subType: 'array',
      stepParams: {
        fieldSettings: {
          init: { dataSourceKey: 'external', collectionName: 'shipments', fieldPath: 'route_delivery_number' },
        },
      },
    });
    const invoice = (await models.findOne({ filter: { uid: 'invoice' } })).get('options');
    await simplifyShipmentFields(db);
    await simplifyShipmentFields(db);
    for (const uid of ['delivery', 'deliveryinput', 'date', 'dateinput', 'oldcolumn']) {
      expect(await models.findOne({ filter: { uid } })).toBeNull();
      expect(await db.getRepository('flowModelTreePath').count({ filter: { descendant: uid } })).toBe(0);
    }
    expect((await models.findOne({ filter: { uid: 'invoice' } })).get('options')).toEqual(invoice);
    expect(
      (await models.findOne({ filter: { uid: 'grid' } })).get('options').stepParams.gridSettings.grid.rows,
    ).toEqual({ first: [['invoice']], third: [['ntm']] });
    expect(
      (await models.findOne({ filter: { uid: 'grid' } })).get('options').stepParams.gridSettings.grid.sizes,
    ).toEqual({ first: [3], third: [4] });
    expect((await models.findOne({ filter: { uid: 'ntm' } })).get('options').props.label).toBe(
      'Товары для сертификата',
    );
    expect((await models.findOne({ filter: { uid: 'ntmcolumn' } })).get('options')).toMatchObject({
      props: { title: 'СС/ДС', width: 175 },
      stepParams: { tableColumnSettings: { title: { title: 'СС/ДС' } } },
    });
    expect((await models.findOne({ filter: { uid: 'category' } })).get('options').props.workspaceSectionTitle).toBe(
      'НТМ',
    );
    expect(await models.findOne({ filter: { uid: 'unrelated' } })).not.toBeNull();
    expect(await models.findOne({ filter: { uid: 'external' } })).not.toBeNull();
    expect((await models.findOne({ filter: { uid: 'table' } })).get('options').props.searchableFieldNames).toEqual([
      'invoice_number',
    ]);
  });

  it('preserves business values and unrelated preferences, cleans templates once without resetting other columns', async () => {
    await seed();
    const shipment = await db.getRepository('shipments').create({
      values: {
        route_delivery_number: 'ARCHIVE',
        declaration_release_date: '2026-10-20',
        application_release_date: '2026-10-21',
      },
    });
    const before = shipment.toJSON();
    for (const collectionName of ['shipments', 'logistics_work_items']) {
      for (const name of [...ARCHIVED_SHIPMENT_FIELDS, 'ntm_certificate_goods'])
        await db.getRepository('fields').create({
          values: {
            collectionName,
            name,
            options: {
              custom: 'keep',
              uiSchema: {
                title: name.startsWith('ntm_') ? 'НТМ: Товары для сертификата' : name,
                'x-component-props': { custom: true },
              },
            },
          },
        });
    }
    const synthetic = `lc_field_${createHash('sha256')
      .update(JSON.stringify(['main', 'logistics_work_items', 'route_delivery_number']))
      .digest('hex')}`;
    const settings = {
      version: 1,
      columnOrder: ['oldcolumn', synthetic, 'ntmcolumn'],
      hiddenColumnUids: [synthetic],
      columnWidths: { oldcolumn: 120, [synthetic]: 130, ntmcolumn: 175 },
    };
    const saved = await db.getRepository('lc_table_filter_templates').create({
      values: {
        userId: 1,
        instanceKey: 'key',
        instanceRootUid: 'root',
        tableUid: 'table',
        id: 'template-1',
        name: 'Мой вид',
        revision: 7,
        columnSettings: settings,
        filter: {
          logic: '$and',
          items: [
            { logic: '$or', items: [{ path: 'declaration_release_date', operator: '$eq', value: '2026-10-20' }] },
            { path: 'status', operator: '$eq', value: 'queue' },
          ],
        },
      },
    });
    const unrelated = await db
      .getRepository('lc_table_personalizations')
      .create({ values: { userId: 1, instanceKey: 'other', instanceRootUid: 'root', tableUid: 'other', settings } });
    await simplifyShipmentFields(db);
    await simplifyShipmentFields(db);
    const result = await db.getRepository('lc_table_filter_templates').findOne({ filter: { id: saved.get('id') } });
    expect(result.get('revision')).toBe(8);
    expect(result.get('filter')).toEqual({
      logic: '$and',
      items: [{ path: 'status', operator: '$eq', value: 'queue' }],
    });
    expect(result.get('columnSettings')).toEqual({
      version: 1,
      columnOrder: ['ntmcolumn'],
      hiddenColumnUids: [],
      columnWidths: { ntmcolumn: 175 },
    });
    expect(
      (await db.getRepository('lc_table_personalizations').findOne({ filter: { id: unrelated.get('id') } })).get(
        'settings',
      ),
    ).toEqual(settings);
    expect((await db.getRepository('shipments').findOne({ filter: { id: shipment.get('id') } })).toJSON()).toEqual(
      before,
    );
    const fields = await db.getRepository('fields').find();
    for (const field of fields) {
      expect(field.get('options')).toMatchObject({
        custom: 'keep',
        uiSchema: { 'x-component-props': { custom: true } },
      });
      if (ARCHIVED_SHIPMENT_FIELDS.has(field.get('name'))) expect(field.get('options').hidden).toBe(true);
      else expect(field.get('options').uiSchema.title).toBe('Товары для сертификата');
    }
  });
});
