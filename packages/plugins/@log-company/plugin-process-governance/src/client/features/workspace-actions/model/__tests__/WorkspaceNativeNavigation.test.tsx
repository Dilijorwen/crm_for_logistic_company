/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { App, ConfigProvider } from 'antd';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Application, FlowRoute, openView, RouteModel } from '@nocobase/client';
import {
  FlowEngineProvider,
  FlowEngineGlobalsContextProvider,
  FlowModel,
  observable,
  observer,
  type FlowEngine,
} from '@nocobase/flow-engine';
import { describe, expect, it, vi } from 'vitest';
import { LogisticsWorkspacePopupActionModel } from '../WorkspacePopupActionModel';
import { openWorkspaceRun, openWorkspaceShipment, openWorkspaceCreateShipment } from '../openWorkspaceView';
import { WorkspaceReturnButton } from '../../ui/WorkspaceReturnButton';

vi.mock('../../../../../../../../../core/client/src/route-switch', async (original) => {
  const actual = await original<Record<string, unknown>>();
  return {
    ...actual,
    useCurrentRoute: () => ({ schemaUid: 'lclogworkspace' }),
    useAllAccessDesktopRoutes: () => ({ refresh() {} }),
    useKeepAlive: () => ({ active: true }),
    useMobileLayout: () => ({ isMobileLayout: false }),
  };
});

const Content = observer(({ model }: { model: FlowModel }) => {
  const view = model.context.view;
  const args = view.inputArgs;
  const uid = args.viewUid;
  if (uid === 'lclogworkspace')
    return (
      <section data-testid="work-list">
        <input aria-label="Поиск рабочего списка" />
        <button onClick={() => openWorkspaceRun(model, '10')}>Рейс 30</button>
        <button onClick={() => openWorkspaceRun(model, '11')}>Рейс 35</button>
      </section>
    );
  if (uid === 'lcwsrecordpopup')
    return (
      <section data-testid="run-card">
        <span>Рейс ID {String(args.workspaceRunId)}</span>
        <input aria-label="Черновик рейса" />
        <button onClick={() => view.navigation?.changeTo({ tabUid: 'lcwsshiptab' })}>Поставки рейса</button>
        <output data-testid="active-run-tab">{view.navigation?.viewParams.tabUid}</output>
        <button onClick={() => openWorkspaceShipment(model, String(args.workspaceRunId), '101')}>Поставка 21</button>
        <button onClick={() => openWorkspaceCreateShipment(model, String(args.workspaceRunId))}>
          Создать поставку
        </button>
        <button onClick={() => view.close()}>Закрыть рейс</button>
      </section>
    );
  return (
    <section data-testid="shipment-card">
      <output data-testid="shipment-id">{String(args.workspaceShipmentId || 'new')}</output>
      <output data-testid="creation-run">{JSON.stringify(args.formData)}</output>
      <WorkspaceReturnButton host={model} />
    </section>
  );
});
class ContentPage extends FlowModel {
  render() {
    return <Content model={this} />;
  }
}

function fixture() {
  const engine = new Application().flowEngine;
  engine.registerModels({ RouteModel, ContentPage, LogisticsWorkspacePopupActionModel });
  engine.registerActions({ openView });
  engine.context.defineProperty('flowSettingsEnabled', { value: false });
  const route = observable.ref({ pathname: '/admin/lclogworkspace', params: { name: 'lclogworkspace' } });
  engine.context.defineProperty('route', { get: () => route.value, cache: false });
  const router = {
    state: { location: { pathname: route.value.pathname, state: undefined as unknown } },
    navigate: (pathname: string, options?: { state?: unknown }) => {
      router.state.location = { pathname, state: options?.state };
      route.value = { ...route.value, pathname };
    },
  };
  engine.context.defineProperty('router', { value: router });
  engine.context.defineProperty('api', {
    value: { resource: () => ({ get: async () => ({ data: { data: { run_number: 30 } } }) }) },
  });
  for (const [uid, collectionName, mode] of [
    ['lcwsrecordpopup', 'logistics_work_items', 'dialog'],
    ['lcwsshippagepopup', 'shipments', 'embed'],
    ['lcwsnewshipment', 'shipments', 'embed'],
  ])
    engine.createModel({
      uid,
      use: 'LogisticsWorkspacePopupActionModel',
      stepParams: {
        popupSettings: { openView: { dataSourceKey: 'main', collectionName, mode, size: 'large', navigation: true } },
      },
    });
  vi.spyOn(engine, 'loadModel').mockImplementation(async function (this: FlowEngine, { uid }) {
    return this.getModel(uid, true) || null;
  });
  // Only persistence is replaced. FlowRoute, openView, view holders, scoped engines,
  // hide/close/beforeClose and route diffing all execute their real implementation.
  vi.spyOn(engine, 'loadOrCreateModel').mockImplementation(async function (this: FlowEngine, options) {
    const uid = `content-${options.parentId}`;
    return this.getModel(uid) || this.createModel({ uid, use: ContentPage });
  });
  function Ready() {
    const [ready, setReady] = React.useState(false);
    React.useEffect(() => setReady(true), []);
    return ready ? <FlowRoute /> : null;
  }
  const rendered = render(
    <ConfigProvider>
      <App>
        <FlowEngineProvider engine={engine}>
          <FlowEngineGlobalsContextProvider>
            <Ready />
          </FlowEngineGlobalsContextProvider>
        </FlowEngineProvider>
      </App>
    </ConfigProvider>,
  );
  return { engine, route, ...rendered };
}

describe('native CRM view lifecycle without a browser', () => {
  it('opens a shipment as a page, returns to the same run tab and preserves list and run state repeatedly', async () => {
    const { route } = fixture();
    const search = await screen.findByRole('textbox', { name: 'Поиск рабочего списка' });
    fireEvent.change(search, { target: { value: 'ЮРА' } });
    fireEvent.click(screen.getByText('Рейс 30'));
    const run = await screen.findByTestId('run-card');
    const draft = screen.getByRole('textbox', { name: 'Черновик рейса' });
    fireEvent.change(draft, { target: { value: 'сохранить состояние' } });
    fireEvent.click(screen.getByText('Поставки рейса'));
    await waitFor(() => expect(screen.getByTestId('active-run-tab')).toHaveTextContent('lcwsshiptab'));
    run.scrollTop = 120;
    for (let iteration = 0; iteration < 3; iteration++) {
      fireEvent.click(screen.getByText('Поставка 21'));
      await waitFor(() => expect(screen.getByTestId('shipment-id')).toHaveTextContent('101'));
      expect(route.value.pathname).toContain('/view/lcwsshippagepopup/');
      await screen.findByRole('button', { name: 'К поставкам рейса №30' });
      fireEvent.click(screen.getByRole('button', { name: /К поставкам рейса/ }));
      await waitFor(() => expect(screen.queryByTestId('shipment-card')).toBeNull());
      expect(screen.getByTestId('run-card')).toBe(run);
      expect(run.scrollTop).toBe(120);
      expect(draft).toHaveValue('сохранить состояние');
    }
    fireEvent.click(screen.getByText('Закрыть рейс'));
    await waitFor(() => expect(screen.queryByTestId('run-card')).toBeNull());
    expect(search).toHaveValue('ЮРА');
    fireEvent.click(screen.getByText('Рейс 35'));
    await waitFor(() => expect(screen.getByTestId('run-card')).toHaveTextContent('Рейс ID 11'));
  });

  it('opens and cancels creation, retaining the source run and allowing another opening', async () => {
    fixture();
    fireEvent.click(await screen.findByText('Рейс 30'));
    await screen.findByTestId('run-card');
    for (let iteration = 0; iteration < 2; iteration++) {
      fireEvent.click(screen.getByText('Создать поставку'));
      await waitFor(() => expect(screen.getByTestId('creation-run')).toHaveTextContent('"runs":[{"id":"10"}]'));
      fireEvent.click(screen.getByRole('button', { name: /К поставкам рейса/ }));
      await waitFor(() => expect(screen.queryByTestId('shipment-card')).toBeNull());
      expect(screen.getByTestId('run-card')).toHaveTextContent('Рейс ID 10');
    }
  });
});
