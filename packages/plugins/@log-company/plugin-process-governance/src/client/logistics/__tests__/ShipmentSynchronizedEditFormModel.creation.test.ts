/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Application, CreateFormModel, EditFormModel, FormGridModel, layout } from '@nocobase/client';
import { type CreateModelOptions, FlowRuntimeContext, SingleRecordResource } from '@nocobase/flow-engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginProcessGovernanceClient } from '../../index';
import { ShipmentSynchronizedEditFormModel } from '../ShipmentSynchronizedEditFormModel';

const layoutParams = {
  layout: 'vertical',
  labelAlign: 'left',
  labelWidth: 120,
  labelWrap: true,
  colon: true,
};

afterEach(() => {
  vi.restoreAllMocks();
});

async function createScenario(collectionName = 'shipments', shouldLoadPlugin = true) {
  const app = new Application();
  const engine = app.flowEngine;
  engine.context.defineProperty('app', { value: app });
  engine.context.defineProperty('view', {
    value: { inputArgs: { dataSourceKey: 'main', collectionName, filterByTk: 'record-1' } },
  });
  const dataSource = engine.context.dataSourceManager.getDataSource('main');
  if (!dataSource) {
    throw new Error('Expected the main data source');
  }
  dataSource.addCollection({
    name: collectionName,
    filterTargetKey: 'id',
    fields: [
      { name: 'id', type: 'string', interface: 'input' },
      { name: 'name', type: 'string', interface: 'input' },
    ],
  });
  engine.registerModels({ EditFormModel, CreateFormModel, FormGridModel });
  if (shouldLoadPlugin) {
    await new PluginProcessGovernanceClient({}, app).load();
  }
  const RegisteredEditForm = engine.getModelClass('EditFormModel') as typeof EditFormModel;
  const parent = engine.createModel({ use: 'FlowModel' });
  const items = await RegisteredEditForm.defineChildren(parent.context);
  const item = items.find((candidate) => candidate.label === 'Current record');
  expect(item).toBeDefined();
  return { engine, options: item.createModelOptions as CreateModelOptions };
}

function applyLayout(model: EditFormModel): void {
  layout.handler(new FlowRuntimeContext(model, 'formModelSettings'), layoutParams);
}

function getFormGrid(model: EditFormModel | CreateFormModel): FormGridModel {
  const grid = model.subModels?.grid;
  if (!(grid instanceof FormGridModel)) {
    throw new Error('Expected a standard form grid');
  }
  return grid;
}

describe('registered EditFormModel creation', () => {
  it('creates a new standard form before the plugin replaces its registration', async () => {
    const { engine, options } = await createScenario('shipments', false);
    const model = engine.createModel<EditFormModel>(options);

    expect(model).toBeInstanceOf(EditFormModel);
    expect(model).not.toBeInstanceOf(ShipmentSynchronizedEditFormModel);
    expect(getFormGrid(model)).toBeInstanceOf(FormGridModel);
    expect(() => applyLayout(model)).not.toThrow();
  });

  it.each(['shipments', 'transport_runs', 'chinese_clients'])(
    'creates a configurable grid from the designer menu for %s',
    async (collectionName) => {
      const { engine, options } = await createScenario(collectionName);

      const model = engine.createModel<ShipmentSynchronizedEditFormModel>({ ...options, use: 'EditFormModel' });
      expect(() => applyLayout(model)).not.toThrow();

      expect(options).toMatchObject({
        use: 'EditFormModel',
        subModels: { grid: { use: 'FormGridModel' } },
        stepParams: {
          resourceSettings: {
            init: {
              dataSourceKey: 'main',
              collectionName,
              filterByTk: '{{ctx.view.inputArgs.filterByTk}}',
            },
          },
        },
      });
      expect(model).toBeInstanceOf(ShipmentSynchronizedEditFormModel);
      const grid = getFormGrid(model);
      expect(grid.parent).toBe(model);
      expect(model.getResourceSettingsInitParams().collectionName).toBe(collectionName);
      expect(model.getAclActionName()).toBe('update');

      const field = grid.addSubModel('items', { use: 'FlowModel' });
      expect(() => applyLayout(model)).not.toThrow();
      expect(field.props).toMatchObject({ layout: 'vertical', labelWidth: '100%' });
    },
  );

  it('preserves the standard definition and creates the grid when only the registered use is provided', async () => {
    const { engine, options } = await createScenario();
    expect(ShipmentSynchronizedEditFormModel.meta).toEqual(EditFormModel.meta);
    const { subModels, ...minimalOptions } = options;

    const model = engine.createModel<ShipmentSynchronizedEditFormModel>(minimalOptions);

    expect(getFormGrid(model)).toBeInstanceOf(FormGridModel);
    expect(() => applyLayout(model)).not.toThrow();
  });

  it('preserves an existing form grid, field settings and action through a serialization round trip', async () => {
    const { engine, options } = await createScenario();
    const model = engine.createModel<ShipmentSynchronizedEditFormModel>({
      ...options,
      use: 'EditFormModel',
      uid: 'existing-form',
      subModels: {
        grid: {
          uid: 'existing-grid',
          use: 'FormGridModel',
          stepParams: { gridSettings: { layout: { rows: [['existing-field']] } } },
          subModels: {
            items: [
              {
                uid: 'existing-field',
                use: 'FlowModel',
                stepParams: { fieldSettings: { init: { fieldPath: 'name' } } },
              },
            ],
          },
        },
        actions: [{ uid: 'existing-submit', use: 'FlowModel', props: { title: 'Сохранить' } }],
      },
    });
    const serialized = model.serialize();
    const { engine: reloadEngine } = await createScenario();
    const reloaded = reloadEngine.createModel<ShipmentSynchronizedEditFormModel>(serialized as CreateModelOptions);

    expect(reloaded.serialize()).toEqual(serialized);
    const grid = getFormGrid(reloaded);
    expect(grid.uid).toBe('existing-grid');
    expect(grid.subModels?.items[0].getStepParams('fieldSettings', 'init')).toEqual({
      fieldPath: 'name',
    });
    expect(() => applyLayout(reloaded)).not.toThrow();
  });

  it('retains shipment save synchronization and leaves other collection resources unchanged', async () => {
    const save = vi.spyOn(SingleRecordResource.prototype, 'save').mockResolvedValue(undefined);
    const refresh = vi.spyOn(SingleRecordResource.prototype, 'refresh').mockResolvedValue(undefined);
    const { engine, options } = await createScenario();
    const model = engine.createModel<ShipmentSynchronizedEditFormModel>({ ...options, use: 'EditFormModel' });
    const resetDirtyFields = vi.spyOn(model, 'resetUserModifiedFields');
    const resource = model.createResource(model.context, {
      dataSourceKey: 'main',
      collectionName: 'shipments',
      filterByTk: 'record-1',
    });
    expect(resource).toBeInstanceOf(SingleRecordResource);
    if (!(resource instanceof SingleRecordResource)) {
      throw new Error('Expected a single-record shipment resource');
    }

    await resource.save({ id: 'record-1', status: 'queue' });
    await resource.refresh();

    expect(save).toHaveBeenCalledWith({ id: 'record-1', status: 'queue' }, undefined);
    expect(refresh).toHaveBeenCalledOnce();
    expect(resetDirtyFields).toHaveBeenCalledOnce();
    const runResource = model.createResource(model.context, {
      dataSourceKey: 'main',
      collectionName: 'transport_runs',
      filterByTk: 'run-1',
    });
    if (!(runResource instanceof SingleRecordResource)) {
      throw new Error('Expected a single-record run resource');
    }
    expect(runResource.save).toBe(save);
    expect(runResource.refresh).toBe(refresh);
  });

  it('keeps the standard create form registration and its grid', async () => {
    const { engine } = await createScenario();

    expect(engine.getModelClass('CreateFormModel')).toBe(CreateFormModel);
    const model = engine.createModel<CreateFormModel>({
      use: 'CreateFormModel',
      stepParams: { resourceSettings: { init: { dataSourceKey: 'main', collectionName: 'shipments' } } },
    });
    expect(getFormGrid(model)).toBeInstanceOf(FormGridModel);
  });
});
