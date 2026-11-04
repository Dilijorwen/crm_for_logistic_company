/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Application, openView } from '@nocobase/client';
import { FlowModel, ViewNavigation, type ViewParam } from '@nocobase/flow-engine';
import { describe, expect, it, vi } from 'vitest';
import { LogisticsWorkspacePopupActionModel } from '../WorkspacePopupActionModel';
import {
  openWorkspaceView,
  openWorkspaceCreateShipment,
  openWorkspaceShipment,
  openWorkspaceRun,
} from '../openWorkspaceView';

function setup(stack: ViewParam[] = [{ viewUid: 'lclogworkspace' }]) {
  const engine = new Application().flowEngine;
  engine.registerModels({ LogisticsWorkspacePopupActionModel });
  engine.registerActions({ openView });
  engine.context.defineProperty('themeToken', { value: { colorBgLayout: '#fff' } });
  const open = vi.fn(async () => undefined);
  engine.context.defineProperty('viewer', { value: { open } });
  const navigate = vi.fn();
  engine.context.defineProperty('router', { value: { navigate } });
  const navigation = new ViewNavigation(engine.context, stack);
  const owner = engine.createModel({ use: FlowModel });
  owner.context.defineProperty('view', {
    value: { type: 'embed', inputArgs: { viewUid: stack.at(-1)?.viewUid }, navigation },
  });
  const models = ['lcwsrecordpopup', 'lcwsshippagepopup', 'lcwsnewshipment'].map((uid) =>
    engine.createModel({ uid, use: 'LogisticsWorkspacePopupActionModel' }),
  );
  vi.spyOn(engine, 'loadModel').mockImplementation(async ({ uid }) => engine.getModel(uid) || null);
  return { engine, owner, navigation, navigate, models, open };
}

describe('workspace native view navigation', () => {
  it('opens the exact run repeatedly without changing shared model parents or contexts', async () => {
    const { owner, models, navigate } = setup();
    const contexts = models.map((model) => model.context.view);
    for (const id of ['10', '11', '10']) await openWorkspaceRun(owner, id);
    expect(navigate.mock.calls.map(([path]) => path)).toEqual([
      '/admin/lclogworkspace/view/lcwsrecordpopup/tab/lcwsruntab/filterbytk/10%3A0',
      '/admin/lclogworkspace/view/lcwsrecordpopup/tab/lcwsruntab/filterbytk/11%3A0',
      '/admin/lclogworkspace/view/lcwsrecordpopup/tab/lcwsruntab/filterbytk/10%3A0',
    ]);
    expect(models.map((model) => model.parent)).toEqual([undefined, undefined, undefined]);
    expect(models.map((model) => model.context.view)).toEqual(contexts);
  });

  it('keeps the native run stack and shipments tab when navigating to a shipment and back', async () => {
    const { owner, navigation, navigate } = setup([
      { viewUid: 'lclogworkspace' },
      { viewUid: 'lcwsrecordpopup', filterByTk: '10:100', tabUid: 'lcwsshiptab' },
    ]);
    await openWorkspaceShipment(owner, '10', '101');
    const path = navigate.mock.calls[0][0];
    expect(path).toContain(
      '/lcwsrecordpopup/tab/lcwsshiptab/filterbytk/10%3A100/view/lcwsshippagepopup/tab/lcwsshipmentfulltab/filterbytk/101/sourceid/10',
    );
    expect(navigation.viewStack).toHaveLength(2);
    expect(owner.context.view.inputArgs).toEqual({ viewUid: 'lcwsrecordpopup' });
  });

  it('serializes the current run for creation and keeps association context out of the source form', async () => {
    const { owner, navigate, models, open } = setup();
    await openWorkspaceCreateShipment(owner, '10');
    expect(navigate).toHaveBeenCalledWith(
      '/admin/lclogworkspace/view/lcwsnewshipment/tab/lcwsnewshiptab/sourceid/10',
      undefined,
    );
    const create = models[2];
    const args = { sourceId: '10', collectionName: 'shipments', mode: 'drawer', size: 'small' };
    await create.applyFlow('popupSettings', args);
    expect(open).toHaveBeenCalled();
    expect(open.mock.calls[0][0]).toMatchObject({ type: 'dialog', width: '80%' });
    expect(open.mock.calls[0][0].inputArgs).toMatchObject({
      workspaceRunId: '10',
      sourceId: null,
      associationName: null,
      formData: { runs: [{ id: '10' }] },
    });
  });

  it('resolves the source shipment and its return context through the native popup flow', async () => {
    const { engine, models, navigation, open } = setup([
      { viewUid: 'lclogworkspace' },
      { viewUid: 'lcwsrecordpopup' },
      { viewUid: 'lcwsshippagepopup' },
    ]);
    const get = vi.fn().mockResolvedValue({ data: { data: { run_number: 35 } } });
    engine.context.defineProperty('api', { value: { resource: () => ({ get }) } });
    const args = { sourceId: '10', filterByTk: '101', collectionName: 'shipments', navigation };
    await models[1].applyFlow('popupSettings', args);
    expect(open).toHaveBeenCalled();
    expect(open.mock.calls[0][0].inputArgs).toMatchObject({
      workspaceRunId: '10',
      workspaceShipmentId: '101',
      workspaceReturnToRun: true,
      sourceId: null,
    });
    expect(get).not.toHaveBeenCalled();
  });

  it('gives native source actions the same creation tab and preserves their run-card stack', async () => {
    const { owner, navigate } = setup([
      { viewUid: 'lclogworkspace' },
      { viewUid: 'lcwsrecordpopup', filterByTk: '10:100', tabUid: 'lcwsshiptab' },
    ]);
    await openWorkspaceView(owner, 'lcwsnewshipment', { workspaceRunId: '10' });
    expect(navigate).toHaveBeenCalledWith(
      '/admin/lclogworkspace/view/lcwsrecordpopup/tab/lcwsshiptab/filterbytk/10%3A100/view/lcwsnewshipment/tab/lcwsnewshiptab/sourceid/10',
      undefined,
    );
  });

  it('switches the current run instead of nesting the same shared popup inside itself', async () => {
    const { owner, navigate } = setup([{ viewUid: 'lclogworkspace' }, { viewUid: 'lcwsrecordpopup' }]);
    await openWorkspaceRun(owner, '11');
    expect(navigate).toHaveBeenCalledWith(
      '/admin/lclogworkspace/view/lcwsrecordpopup/tab/lcwsruntab/filterbytk/11%3A0',
      { replace: true },
    );
  });
});
