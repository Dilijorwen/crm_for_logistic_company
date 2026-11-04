/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createBlockScopedEngine, FlowContext, FlowEngine, FlowModel } from '@nocobase/flow-engine';
import { Application, CollectionBlockModel, EditFormModel } from '@nocobase/client';
import { describe, expect, it, vi } from 'vitest';
import { LogisticsWorkspaceContextBlockModel, LogisticsWorkspaceTabsBlockModel } from '../WorkspaceContextModels';

describe('native workspace source context', () => {
  it.each([
    ['shipment', 'shipments', '100'],
    ['run', 'transport_runs', '10'],
  ])('saves %s through its source endpoint with a defined key', async (entity, collectionName, id) => {
    const app = new Application();
    const engine = app.flowEngine;
    engine.context.defineProperty('app', { value: app });
    engine.context.defineProperty('view', {
      value: {
        inputArgs: {
          collectionName: 'logistics_work_items',
          filterByTk: '10:100',
          workspaceRunId: '10',
          workspaceShipmentId: '100',
          associationName: 'transport_runs.shipments',
        },
      },
    });
    engine.context.dataSourceManager.getDataSource('main')?.addCollection({
      name: collectionName,
      filterTargetKey: 'id',
      fields: [{ name: 'id', type: 'string', interface: 'input' }],
    });
    const source = engine.createModel({ use: LogisticsWorkspaceContextBlockModel, props: { entity } });
    const form = engine.createModel({
      use: EditFormModel,
      parentId: source.uid,
      stepParams: {
        resourceSettings: {
          init: {
            dataSourceKey: 'main',
            collectionName,
            associationName: null,
            sourceId: null,
            filterByTk:
              entity === 'run' ? '{{ctx.view.inputArgs.workspaceRunId}}' : '{{ctx.view.inputArgs.workspaceShipmentId}}',
          },
        },
      },
    });
    const resolved = await form.context.resolveJsonTemplate(form.getResourceSettingsInitParams());
    const init = CollectionBlockModel.globalFlowRegistry.getFlow('resourceSettings')?.getStep('init')?.serialize()
      .handler;
    expect(init).toBeTypeOf('function');
    await init?.({ resource: form.resource }, resolved);
    form.resource.setAPIClient(app.apiClient);
    const request = vi.spyOn(app.apiClient, 'request').mockResolvedValue({ data: { data: { id } } });
    await form.resource.save({ id }, { refresh: false });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ url: `${collectionName}:update`, params: expect.objectContaining({ filterByTk: id }) }),
    );
    request.mockRestore();
  });

  it('isolates shipment section tabs from the outer run/shipment tab navigation', () => {
    const engine = new FlowEngine();
    const outer = {
      inputArgs: { tabUid: 'lcwsshiptab', workspaceShipmentId: '100' },
      navigation: { viewParams: { tabUid: 'lcwsshiptab' } },
    };
    engine.context.defineProperty('view', { value: outer });
    const tabs = engine.createModel({ use: LogisticsWorkspaceTabsBlockModel });
    expect(tabs.context.view.inputArgs.tabUid).toBeUndefined();
    expect(tabs.context.view.navigation).toBeUndefined();
    expect(tabs.context.view.inputArgs.workspaceShipmentId).toBe('100');
    expect(outer.inputArgs.tabUid).toBe('lcwsshiptab');
  });
  it('passes the real source key to nested blocks without changing the popup key', () => {
    const engine = new FlowEngine();
    const parent = engine.createModel({ use: FlowModel });
    const popupView = {
      inputArgs: { collectionName: 'logistics_work_items', filterByTk: '10:100' },
      close: () => undefined,
    };
    parent.context.defineProperty('view', { value: popupView });
    for (const [entity, collectionName, filterByTk] of [
      ['run', 'transport_runs', '10'],
      ['shipment', 'shipments', '100'],
    ]) {
      const context = engine.createModel({
        use: LogisticsWorkspaceContextBlockModel,
        parentId: parent.uid,
        props: { entity },
      });
      expect(context.context.view.inputArgs).toMatchObject({
        collectionName,
        filterByTk,
        sourceId: null,
        associationName: null,
      });
      expect(context.context.view.close).toBe(popupView.close);
    }
    expect(popupView.inputArgs.filterByTk).toBe('10:100');
  });

  it('keeps each numbered shipment editor isolated from the first shipment and other editors', async () => {
    const parent = new FlowEngine();
    parent.context.defineProperty('view', {
      value: { inputArgs: { filterByTk: '10:100', workspaceRunId: '10', workspaceShipmentId: '100' } },
    });
    parent.registerModels({ LogisticsWorkspaceContextBlockModel });
    const template = parent.createModel({
      uid: 'shared-editor',
      use: LogisticsWorkspaceContextBlockModel,
      props: { entity: 'shipment', isolated: true },
    });
    const engines = ['101', '102'].map((id) => {
      const engine = createBlockScopedEngine(parent);
      const context = new FlowContext();
      context.addDelegate(parent.context);
      context.defineProperty('view', {
        value: {
          inputArgs: { collectionName: 'shipments', filterByTk: id, workspaceShipmentId: id, workspaceRunId: '10' },
        },
      });
      const model = engine.createModel(template.serialize(), { delegateToParent: false, delegate: context });
      expect(model).not.toBe(template);
      expect(model.context.record).toEqual({ id });
      expect(model.context.view.inputArgs.filterByTk).toBe(id);
      return engine;
    });
    expect(template.context.view.inputArgs.filterByTk).toBe('100');
    expect(engines[0].getModel('shared-editor')?.context.record).toEqual({ id: '101' });
    expect(engines[1].getModel('shared-editor')?.context.record).toEqual({ id: '102' });
    engines.forEach((engine) => engine.unlinkFromStack());
  });

  it('keeps create form defaults and never invents a shipment for an empty run', () => {
    const engine = new FlowEngine();
    engine.context.defineProperty('view', {
      value: { inputArgs: { filterByTk: '10:0', formData: { runs: [{ id: '10' }] } } },
    });
    const empty = engine.createModel({ use: LogisticsWorkspaceContextBlockModel, props: { entity: 'shipment' } });
    expect(empty.context.view.inputArgs.filterByTk).toBeNull();
    const create = engine.createModel({
      use: LogisticsWorkspaceContextBlockModel,
      props: { entity: 'shipment', creation: true },
    });
    expect(create.context.view.inputArgs).toMatchObject({
      collectionName: 'shipments',
      filterByTk: null,
      formData: { runs: [{ id: '10' }] },
    });
  });

  it('resolves resource templates to real source IDs through nested models and replaces the outer row record', async () => {
    const engine = new FlowEngine();
    engine.context.defineProperty('view', {
      value: {
        inputArgs: {
          collectionName: 'logistics_work_items',
          filterByTk: '10:100',
          workspaceRunId: '10',
          workspaceShipmentId: '100',
        },
      },
    });
    engine.context.defineProperty('record', { value: { id: '10:100' } });
    for (const [entity, id] of [
      ['run', '10'],
      ['shipment', '100'],
    ]) {
      const source = engine.createModel({ use: LogisticsWorkspaceContextBlockModel, props: { entity } });
      const nested = engine.createModel({ use: FlowModel, parentId: source.uid });
      expect(nested.context.record).toEqual({ id });
      expect(
        await nested.context.resolveJsonTemplate({
          run: '{{ctx.view.inputArgs.workspaceRunId}}',
          shipment: '{{ctx.view.inputArgs.workspaceShipmentId}}',
        }),
      ).toEqual({ run: '10', shipment: '100' });
    }
  });
});
