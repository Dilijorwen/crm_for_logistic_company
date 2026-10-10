/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Application, TableActionsColumnModel, TableBlockModel, TableSelectModel } from '@nocobase/client';
import type { CreateModelOptions, ModelConstructor } from '@nocobase/flow-engine';
import { describe, expect, it } from 'vitest';
import { PluginTablePersonalizationClient } from '../../../../plugin';
import { PersonalizedTableBlockModel } from '../PersonalizedTableBlockModel';

async function scenario(collectionName?: string, loadPlugin = true) {
  const app = new Application();
  const engine = app.flowEngine;
  engine.context.defineProperty('app', { value: app });
  engine.context.defineProperty('view', {
    value: { inputArgs: { dataSourceKey: 'main', collectionName, filterByTk: 'run-1' } },
  });
  const source = engine.dataSourceManager.getDataSource('main');
  if (!source) throw new Error('Expected the main data source');
  source.addCollection({
    name: 'shipments',
    title: 'Поставки',
    filterTargetKey: 'id',
    fields: [{ name: 'id', type: 'string', interface: 'input' }],
  });
  source.addCollection({
    name: 'transport_runs',
    title: 'Рейсы',
    filterTargetKey: 'id',
    fields: [
      { name: 'id', type: 'string', interface: 'input' },
      {
        name: 'shipments',
        title: 'Поставки',
        type: 'hasMany',
        interface: 'o2m',
        target: 'shipments',
        sourceKey: 'id',
        foreignKey: 'transportRunId',
      },
    ],
  });
  engine.registerModels({ TableBlockModel, TableActionsColumnModel, TableSelectModel });
  const plugin = new PluginTablePersonalizationClient({}, app);
  if (loadPlugin) await plugin.load();
  const RegisteredTable = engine.getModelClass('TableBlockModel') as typeof TableBlockModel;
  const parent = engine.createModel({ use: 'FlowModel' });
  return { app, engine, plugin, RegisteredTable, context: parent.context };
}

function expectStandardTable(options: CreateModelOptions, collectionName: string) {
  expect(options).toMatchObject({
    use: 'TableBlockModel',
    subModels: { columns: [{ use: 'TableActionsColumnModel' }] },
    stepParams: { resourceSettings: { init: { dataSourceKey: 'main', collectionName } } },
  });
}

describe('registered TableBlockModel designer creation', () => {
  it('retains the native menu label, search, group, sorting and creation factory', async () => {
    const { RegisteredTable } = await scenario();
    expect(RegisteredTable).toBe(PersonalizedTableBlockModel);
    expect(RegisteredTable.meta).toEqual(TableBlockModel.meta);
    expect(RegisteredTable.meta).toMatchObject({ searchable: true, sort: 300 });
  });

  it.each([false, true])('creates a native actions column from the collection menu (plugin=%s)', async (loadPlugin) => {
    const { engine, RegisteredTable, context } = await scenario(undefined, loadPlugin);
    const items = await RegisteredTable.defineChildren(context);
    const item = items.find((candidate) => candidate.label === 'Рейсы');
    expect(item).toBeDefined();
    const options = item.createModelOptions as CreateModelOptions;
    expectStandardTable(options, 'transport_runs');
    const table = engine.createModel(options);
    if (!(table instanceof TableBlockModel)) throw new Error('Expected a standard table');
    expect(table).toBeInstanceOf(loadPlugin ? PersonalizedTableBlockModel : TableBlockModel);
    expect(table.subModels.columns[0]).toBeInstanceOf(TableActionsColumnModel);
    expect(table.subModels.columns[0].parent).toBe(table);
    expect(table.getAclActionName()).toBe('view');
  });

  it('creates an associated table with the native source record binding and actions column', async () => {
    const { engine, RegisteredTable, context } = await scenario('transport_runs');
    const items = await RegisteredTable.defineChildren(context);
    const associated = items.find((item) => item.label === 'Associated records');
    const item = associated.children().find((candidate: { label: string }) => candidate.label === 'Поставки');
    const options = item.createModelOptions as CreateModelOptions;
    expectStandardTable(options, 'shipments');
    expect(options.stepParams).toMatchObject({
      resourceSettings: {
        init: { associationName: 'transport_runs.shipments', sourceId: '{{ctx.view.inputArgs.filterByTk}}' },
      },
    });
    const table = engine.createModel(options);
    if (!(table instanceof PersonalizedTableBlockModel)) throw new Error('Expected a personalized table');
    expect(table.subModels.columns[0]).toBeInstanceOf(TableActionsColumnModel);
    expect(table.getResourceSettingsInitParams().associationName).toBe('transport_runs.shipments');
  });

  it('keeps the other-records menu and independent collection resource binding', async () => {
    const { RegisteredTable, context } = await scenario('transport_runs');
    const items = await RegisteredTable.defineChildren(context);
    const others = items.find((item) => item.label === 'Other records');
    const item = others.children.find((candidate: { label: string }) => candidate.label === 'Поставки');
    const options = item.createModelOptions as CreateModelOptions;
    expectStandardTable(options, 'shipments');
    expect(options.stepParams?.resourceSettings?.init).not.toHaveProperty('associationName');
    expect(options.stepParams?.resourceSettings?.init).not.toHaveProperty('sourceId');
  });

  it('does not rewrite existing column, search, row-action or resource settings on reload', async () => {
    const { engine } = await scenario();
    const table = engine.createModel({
      uid: 'existing-table',
      use: 'TableBlockModel',
      stepParams: {
        resourceSettings: { init: { dataSourceKey: 'main', collectionName: 'transport_runs' } },
        tableSettings: { pageSize: { pageSize: 50 } },
      },
      subModels: {
        columns: [
          { uid: 'existing-column', use: 'FlowModel', props: { width: 160, fixed: 'left' } },
          {
            uid: 'existing-actions',
            use: 'TableActionsColumnModel',
            subModels: { actions: [{ uid: 'existing-edit', use: 'FlowModel', props: { title: 'Редактировать' } }] },
          },
        ],
        actions: [
          {
            uid: 'existing-search',
            use: 'FlowModel',
            stepParams: { collectionSearchSettings: { fields: { fieldNames: ['id'] } } },
          },
        ],
      },
    });
    const serialized = table.serialize();
    const { engine: reloadEngine } = await scenario();
    const reloaded = reloadEngine.createModel(serialized as CreateModelOptions);
    if (!(reloaded instanceof PersonalizedTableBlockModel)) throw new Error('Expected a personalized table');
    expect(reloaded.serialize()).toEqual(serialized);
    expect(reloaded.subModels.columns.map((column) => column.uid)).toEqual(['existing-column', 'existing-actions']);
  });

  it('preserves the selection-table registration and restores the native table when unloaded', async () => {
    const { engine, plugin } = await scenario();
    expect(engine.getModelClass('TableSelectModel')).toBe(TableSelectModel);
    await plugin.unload();
    expect(engine.getModelClass('TableBlockModel')).toBe(TableBlockModel);
  });

  it('rejects another table extension without replacing its registration', async () => {
    const { engine, plugin } = await scenario(undefined, false);
    class OtherTableExtension extends TableBlockModel {}
    engine.registerModels({ TableBlockModel: OtherTableExtension as ModelConstructor });
    await expect(plugin.load()).rejects.toThrow('TableBlockModel is already extended by another plugin.');
    expect(engine.getModelClass('TableBlockModel')).toBe(OtherTableExtension);
  });
});
