/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Context } from '@nocobase/actions';
import { createMockDatabase, MagicAttributeModel, type Database, type Model } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NocoBaseTableConfiguration } from '../NocoBaseTableConfiguration';

describe('personal column catalog identifiers', () => {
  let db: Database;
  let configuration: NocoBaseTableConfiguration;
  const can = vi.fn();

  beforeEach(async () => {
    db = await createMockDatabase({ dialect: 'sqlite', storage: ':memory:' });
    db.registerModels({
      FlowSchemaModel: MagicAttributeModel as unknown as Parameters<Database['registerModels']>[0][string],
    });
    db.collection({
      name: 'flowModels',
      model: 'FlowSchemaModel',
      magicAttribute: 'options',
      autoGenId: false,
      filterTargetKey: 'uid',
      fields: [
        { name: 'uid', type: 'string', primaryKey: true },
        { name: 'options', type: 'json' },
      ],
    });
    db.collection({
      name: 'flowModelTreePath',
      fields: [
        { name: 'ancestor', type: 'string' },
        { name: 'descendant', type: 'string' },
        { name: 'depth', type: 'integer' },
        { name: 'sort', type: 'integer' },
      ],
    });
    db.collection({
      name: 'desktopRoutes',
      fields: [
        { name: 'schemaUid', type: 'string' },
        { name: 'parentId', type: 'bigInt' },
      ],
    });
    db.collection({
      name: 'roles',
      autoGenId: false,
      filterTargetKey: 'name',
      fields: [
        { name: 'name', type: 'string', primaryKey: true },
        { name: 'desktopRoutes', type: 'belongsToMany', target: 'desktopRoutes', through: 'rolesDesktopRoutes' },
      ],
    });
    db.collection({
      name: 'shipment_history',
      autoGenId: false,
      fields: [
        { name: 'id', type: 'bigInt', primaryKey: true, interface: 'snowflakeId', hidden: false },
        { name: 'shipment_id', type: 'bigInt', isForeignKey: true },
        { name: 'field_label', type: 'string', interface: 'input', uiSchema: { title: 'Название поля' } },
        { name: 'secret', type: 'string', interface: 'input' },
      ],
    });
    await db.sync();
    await db.getRepository('flowModels').create({
      values: {
        uid: 'history-table',
        options: {
          use: 'TableBlockModel',
          stepParams: { resourceSettings: { init: { collectionName: 'shipment_history' } } },
        },
      },
    });
    await db.getRepository('flowModelTreePath').create({
      values: { ancestor: 'page', descendant: 'history-table', depth: 1 },
    });
    const route = await db.getRepository('desktopRoutes').create({ values: { schemaUid: 'page' } });
    await db.getRepository('roles').create({ values: { name: 'manager', desktopRoutes: [route.get('id')] } });
    can.mockReturnValue({ params: { fields: ['id', 'shipment_id', 'field_label'] } });
    const plugin = {
      db,
      app: {
        dataSourceManager: {
          get: () => ({ acl: { can }, collectionManager: { getCollection: (name: string) => db.getCollection(name) } }),
        },
      },
    } as unknown as Plugin;
    configuration = new NocoBaseTableConfiguration(plugin, {
      state: { currentRoles: ['manager'] },
    } as unknown as Context);
  });

  afterEach(async () => db.close());

  it('does not turn automatically readable IDs or foreign keys into selectable columns', async () => {
    const result = await configuration.authorize({ tableUid: 'history-table', referencePath: [] });
    expect(result.columns.map((column) => column.fieldPath)).toEqual(['field_label']);
    expect(result.resizableColumnUids).toEqual(result.columns.map((column) => column.uid));
    expect(result.existingColumnUids.length).toBeGreaterThan(result.columns.length);
  });

  it('preserves an ID column explicitly placed in the shared table by its designer', async () => {
    await db.getRepository('flowModels').create({
      values: {
        uid: 'configured-id',
        options: {
          use: 'TableColumnModel',
          parentId: 'history-table',
          subKey: 'columns',
          stepParams: {
            fieldSettings: { init: { collectionName: 'shipment_history', fieldPath: 'id' } },
            tableColumnSettings: { title: { title: 'ID записи' } },
          },
        },
      },
    });
    expect(
      (await db.getRepository('flowModels').find({ filter: { 'options.parentId': 'history-table' } })).map(
        (model: Model) => model.get('options'),
      ),
    ).toEqual([expect.objectContaining({ use: 'TableColumnModel' })]);
    const result = await configuration.authorize({ tableUid: 'history-table', referencePath: [] });
    expect(result.columns.find((column) => column.uid === 'configured-id')).toMatchObject({ fieldPath: 'id' });
    expect(result.columns.filter((column) => column.source === 'collection').map((column) => column.fieldPath)).toEqual(
      ['field_label'],
    );
  });

  it('continues to reject inaccessible history collections', async () => {
    can.mockReturnValue(null);
    await expect(configuration.authorize({ tableUid: 'history-table', referencePath: [] })).rejects.toThrow(
      'FORBIDDEN',
    );
  });
});
