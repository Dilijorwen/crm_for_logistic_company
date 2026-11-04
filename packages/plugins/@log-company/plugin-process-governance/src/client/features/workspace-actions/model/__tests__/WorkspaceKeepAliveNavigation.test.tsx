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
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  Application,
  RouteModel,
  TableBlockModel,
  TableSelectModel,
  TableColumnModel,
  DisplayTextFieldModel,
  BlockGridModel,
  openView,
} from '@nocobase/client';
import {
  FlowEngineGlobalsContextProvider,
  FlowEngineProvider,
  FlowModel,
  observable,
  observer,
} from '@nocobase/flow-engine';
import { KeepAlive } from '../../../../../../../../../core/client/src/route-switch/antd/admin-layout/KeepAlive';
import { describe, expect, it, vi } from 'vitest';
import { LogisticsWorkspacePopupActionModel } from '../WorkspacePopupActionModel';
import { LogisticsWorkspaceAssociateActionModel } from '../../ui/WorkspaceShipmentActions';
import { WorkspaceShipmentAddButton } from '../../ui/WorkspaceShipmentAddButton';
import { openWorkspaceRun } from '../openWorkspaceView';
import { WorkspaceRunHeader } from '../../../../widgets/workspace-table/ui/WorkspaceRunHeader';
import { WorkspaceTableContext } from '../../../../widgets/workspace-table/model/WorkspaceTableContext';
import { workspaceGroups } from '../../../../widgets/workspace-table/model/workspaceGroups';
import { StableFlowRoute } from '../../../../app/ui/StableFlowRoute';

const PageIdentity = React.createContext('lclogworkspace');
vi.mock('../../../../../../../../../core/client/src/route-switch', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useCurrentRoute: () => ({ schemaUid: React.useContext(PageIdentity) }),
  useAllAccessDesktopRoutes: () => ({ refresh() {} }),
  useMobileLayout: () => ({ isMobileLayout: false }),
}));

function RunBody({ model }: { model: FlowModel }) {
  const runId = String(model.context.view.inputArgs.workspaceRunId);
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    async function load() {
      await model.context.api.resource('transport_runs').get({ filterByTk: runId });
      setLoaded(true);
    }
    load();
  }, [model, runId]);
  return (
    <section data-testid="run-card">
      {loaded ? `Загружен рейс ${runId}` : 'Загрузка рейса'}
      <WorkspaceShipmentAddButton host={model} runId={runId} rowId={`${runId}:0`} />
      <button onClick={() => model.context.view.close()}>Закрыть рейс</button>
    </section>
  );
}
function MainRunHeaders({ model }: { model: FlowModel }) {
  const [selectedRunId, selectRun] = React.useState<string>();
  const [collapsedRunIds, setCollapsed] = React.useState<string[]>([]);
  const table = model.subModels.table as unknown as TableBlockModel;
  const groups = workspaceGroups([
    { id: '10:101', run_number: 30, registration_number: 'P762MH', transport_type: 'road' },
    { id: '11:102', run_number: 31, registration_number: 'P111XX', transport_type: 'road' },
  ]);
  return (
    <WorkspaceTableContext.Provider
      value={{
        table,
        groups,
        selectedRunId,
        collapsedRunIds,
        selectRun,
        toggleRun: (id) =>
          setCollapsed((current) =>
            current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
          ),
      }}
    >
      {groups.map((group) => (
        <WorkspaceRunHeader key={group.id} group={group} />
      ))}
    </WorkspaceTableContext.Provider>
  );
}
class ProbePage extends FlowModel {
  render() {
    const uid = this.context.view.inputArgs.viewUid;
    if (uid === 'szir9dxa6nq') return <p>ТР ТС: документы</p>;
    if (uid === 'lcwsrecordpopup') return <RunBody model={this} />;
    if (uid === 'lcwsnewshipment')
      return (
        <section data-testid="creation-card">
          <output>{JSON.stringify(this.context.view.inputArgs.formData)}</output>
          <button onClick={() => this.context.view.close()}>Отменить создание</button>
        </section>
      );
    return (
      <section data-testid="workspace-list">
        <MainRunHeaders model={this} />
        <WorkspaceShipmentAddButton host={this} runId="10" rowId="10:0" />
      </section>
    );
  }
}

function fixture({ eagerPopupPage = true, deferDocuments = false } = {}) {
  const engine = new Application().flowEngine;
  engine.registerModels({
    RouteModel,
    ProbePage,
    TableBlockModel,
    TableSelectModel,
    TableColumnModel,
    DisplayTextFieldModel,
    BlockGridModel,
    LogisticsWorkspacePopupActionModel,
    LogisticsWorkspaceAssociateActionModel,
  });
  engine.registerActions({ openView });
  engine.context.defineProperty('flowSettingsEnabled', { value: false });
  engine.context.acl.setData({ allowAll: true });
  const source = engine.context.dataSourceManager.getDataSource('main');
  source?.addCollection({
    name: 'shipments',
    filterTargetKey: 'id',
    fields: [
      { name: 'id', type: 'bigInt', interface: 'integer' },
      { name: 'invoice_number', type: 'string', interface: 'input' },
    ],
  });
  source?.addCollection({
    name: 'transport_runs',
    filterTargetKey: 'id',
    fields: [
      { name: 'id', type: 'bigInt', interface: 'integer' },
      { name: 'shipments', type: 'belongsToMany', interface: 'm2m', target: 'shipments' },
    ],
  });
  const route = observable.ref({ pathname: '/admin/lclogworkspace', params: { name: 'lclogworkspace' } });
  const documentsReady = observable.ref(!deferDocuments);
  engine.context.defineProperty('route', { get: () => route.value, cache: false });
  const router = {
    state: { location: { pathname: route.value.pathname } },
    navigate(pathname: string) {
      router.state.location = { pathname };
      route.value = { pathname, params: { name: pathname.split('/')[2] } };
    },
  };
  engine.context.defineProperty('router', { value: router });
  const grid = {
    uid: 'selector-grid',
    use: 'BlockGridModel',
    subModels: {
      items: [
        {
          uid: 'selector-table',
          use: 'TableSelectModel',
          stepParams: { resourceSettings: { init: { dataSourceKey: 'main', collectionName: 'shipments' } } },
          subModels: {
            columns: [
              {
                uid: 'selector-invoice',
                use: 'TableColumnModel',
                stepParams: {
                  fieldSettings: {
                    init: { dataSourceKey: 'main', collectionName: 'shipments', fieldPath: 'invoice_number' },
                  },
                },
                subModels: { field: { uid: 'selector-value', use: 'DisplayTextFieldModel' } },
              },
            ],
          },
        },
      ],
    },
  };
  const findOne = vi.fn(async (query: Record<string, unknown>) => {
    if (query.uid === 'lcwsrecordpopup')
      return {
        uid: 'lcwsrecordpopup',
        parentId: 'workspace-table',
        use: 'LogisticsWorkspacePopupActionModel',
        stepParams: {
          popupSettings: {
            openView: {
              mode: 'dialog',
              size: 'large',
              navigation: true,
              dataSourceKey: 'main',
              collectionName: 'logistics_work_items',
            },
          },
        },
        ...(eagerPopupPage
          ? {
              subModels: {
                page: {
                  uid: 'page-lcwsrecordpopup',
                  parentId: 'lcwsrecordpopup',
                  subKey: 'page',
                  subType: 'object',
                  use: 'ProbePage',
                  subModels: { selector: grid },
                },
              },
            }
          : {}),
      };
    if (query.uid === 'lcwsrsassociate')
      return { uid: 'lcwsrsassociate', use: 'LogisticsWorkspaceAssociateActionModel' };
    if (query.uid === 'lcwsnewshipment')
      return {
        uid: 'lcwsnewshipment',
        use: 'LogisticsWorkspacePopupActionModel',
        stepParams: {
          popupSettings: {
            openView: {
              mode: 'dialog',
              size: 'large',
              navigation: true,
              dataSourceKey: 'main',
              collectionName: 'shipments',
            },
          },
        },
      };
    if (query.parentId === 'lcwsrsassociate') return grid;
    if (query.subKey === 'page')
      return {
        uid: `page-${query.parentId}`,
        parentId: query.parentId,
        subKey: 'page',
        subType: 'object',
        use: 'ProbePage',
        ...(query.parentId === 'lclogworkspace'
          ? {
              subModels: {
                table: {
                  uid: 'workspace-table',
                  use: 'TableBlockModel',
                  stepParams: { resourceSettings: { init: { dataSourceKey: 'main', collectionName: 'shipments' } } },
                },
              },
            }
          : {}),
      };
    return null;
  });
  engine.setModelRepository({ findOne, save: vi.fn(), destroy: vi.fn(), move: vi.fn(), duplicate: vi.fn() });
  const request = vi.spyOn(engine.context.api, 'request').mockImplementation(async (config) => ({
    data: String(config.url).includes(':list')
      ? { data: [{ id: '101', invoice_number: 'IN-4590' }], meta: { count: 1, page: 1, pageSize: 20 } }
      : { data: { id: config.params?.filterByTk } },
  }));
  const Pages = observer(() => (
    <>
      <nav>
        <button onClick={() => router.navigate('/admin/lclogworkspace')}>Рейсы и поставки</button>
        <button onClick={() => router.navigate('/admin/szir9dxa6nq')}>Документы</button>
      </nav>
      <KeepAlive uid={route.value.params.name}>
        {(uid) => (
          <PageIdentity.Provider value={uid}>
            {uid === 'szir9dxa6nq' && !documentsReady.value ? <p>Документы загружаются</p> : <StableFlowRoute />}
          </PageIdentity.Provider>
        )}
      </KeepAlive>
    </>
  ));
  function Ready() {
    const [ready, setReady] = React.useState(false);
    React.useEffect(() => setReady(true), []);
    return ready ? <Pages /> : null;
  }
  const rendered = render(
    <MemoryRouter initialEntries={['/admin/lclogworkspace']}>
      <ConfigProvider>
        <App>
          <FlowEngineProvider engine={engine}>
            <FlowEngineGlobalsContextProvider>
              <Ready />
            </FlowEngineGlobalsContextProvider>
          </FlowEngineProvider>
        </App>
      </ConfigProvider>
    </MemoryRouter>,
  );
  return { engine, route, request, findOne, documentsReady, ...rendered };
}

describe('workspace dialogs with real NocoBase KeepAlive and two FlowRoutes', () => {
  it('keeps a late Documents route attached to its own page after returning to the workspace', async () => {
    const { documentsReady } = fixture({ deferDocuments: true });
    await screen.findByTestId('workspace-list');
    fireEvent.click(screen.getByRole('button', { name: 'Документы', exact: true }));
    await screen.findByText('Документы загружаются');
    fireEvent.click(screen.getByRole('button', { name: 'Рейсы и поставки', exact: true }));
    await act(async () => {
      documentsReady.value = true;
    });
    const header = screen.getByRole('group', { name: 'Выбрать рейс №30' });
    fireEvent.click(within(header).getByText('P762MH'));
    await screen.findByText('Загружен рейс 10');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть рейс' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Документы', exact: true }));
    await screen.findByText('ТР ТС: документы');
  });

  it('loads run cards from both links before and after repeated Documents navigation', async () => {
    const { request } = fixture();
    await screen.findByTestId('workspace-list');
    const list = screen.getByTestId('workspace-list');
    for (const label of ['Рейс №30', 'P762MH', 'Рейс №31', 'P762MH']) {
      fireEvent.click(screen.getByText(label));
      await screen.findByText(label === 'Рейс №31' ? 'Загружен рейс 11' : 'Загружен рейс 10');
      fireEvent.click(screen.getByRole('button', { name: 'Закрыть рейс' }));
      await waitFor(() => expect(screen.queryByTestId('run-card')).toBeNull());
      fireEvent.click(screen.getByRole('button', { name: 'Документы', exact: true }));
      await screen.findByText('ТР ТС: документы');
      fireEvent.click(screen.getByRole('button', { name: 'Рейсы и поставки', exact: true }));
      await waitFor(() => expect(screen.getByTestId('workspace-list')).toBeVisible());
      expect(screen.getByTestId('workspace-list')).toBe(list);
    }
    expect(request.mock.calls.filter(([config]) => String(config.url).includes('transport_runs:get'))).toHaveLength(4);
  });

  it('loads one selector with the current source before and after repeated Documents navigation', async () => {
    const { engine } = fixture();
    await screen.findByTestId('workspace-list');
    for (let attempt = 0; attempt < 3; attempt++) {
      const add = screen.getByRole('button', { name: /Добавить поставку/ });
      await waitFor(() => expect(add).not.toBeDisabled());
      fireEvent.click(add);
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Привязать существующую' }));
      await screen.findByText('IN-4590');
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      const selector = engine.getModel<TableSelectModel>('selector-table', true);
      expect(selector?.context.view.inputArgs.sourceId).toBe('10');
      fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      fireEvent.click(screen.getByRole('button', { name: 'Документы', exact: true }));
      await screen.findByText('ТР ТС: документы');
      fireEvent.click(screen.getByRole('button', { name: 'Рейсы и поставки', exact: true }));
      await waitFor(() => expect(screen.getByTestId('workspace-list')).toBeVisible());
    }
  });

  it('creates in one large dialog from a run header and from the opened run after Documents, retaining its source', async () => {
    fixture();
    await screen.findByTestId('workspace-list');
    for (const fromCard of [false, true]) {
      fireEvent.click(screen.getByRole('button', { name: 'Документы', exact: true }));
      await screen.findByText('ТР ТС: документы');
      fireEvent.click(screen.getByRole('button', { name: 'Рейсы и поставки', exact: true }));
      if (fromCard) {
        fireEvent.click(screen.getByText('P762MH'));
        await screen.findByText('Загружен рейс 10');
        fireEvent.click(within(screen.getByTestId('run-card')).getByRole('button', { name: /Добавить поставку/ }));
      } else {
        fireEvent.click(screen.getAllByRole('button', { name: /Поставка/ })[0]);
      }
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Создать новую поставку' }));
      const creation = await screen.findByTestId('creation-card');
      expect(creation.closest('[role="dialog"]')).not.toBeNull();
      expect(creation.closest('[role="dialog"]')).toHaveStyle({ width: '80%' });
      expect(creation).toHaveTextContent('"runs":[{"id":"10"}]');
      fireEvent.click(screen.getByRole('button', { name: 'Отменить создание' }));
      await waitFor(() => expect(screen.queryByTestId('creation-card')).toBeNull());
      if (fromCard) {
        expect(screen.getByTestId('run-card')).toHaveTextContent('Загружен рейс 10');
        fireEvent.click(screen.getByRole('button', { name: 'Закрыть рейс' }));
        await waitFor(() => expect(screen.queryByTestId('run-card')).toBeNull());
      }
    }
  });

  it('reports a failed page request and retries in the same native dialog after Documents', async () => {
    const { findOne } = fixture({ eagerPopupPage: false });
    await screen.findByTestId('workspace-list');
    fireEvent.click(screen.getByRole('button', { name: 'Документы', exact: true }));
    await screen.findByText('ТР ТС: документы');
    fireEvent.click(screen.getByRole('button', { name: 'Рейсы и поставки', exact: true }));
    const original = findOne.getMockImplementation();
    if (!original) throw new Error('Missing metadata fixture');
    let failed = false;
    findOne.mockImplementation(async (query) => {
      if (query.parentId === 'lcwsrecordpopup' && !failed) {
        failed = true;
        throw new Error('Page metadata unavailable');
      }
      return original(query);
    });
    fireEvent.click(screen.getByText('Рейс №30'));
    await screen.findByText('Не удалось загрузить карточку.');
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await screen.findByText('Загружен рейс 10');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
});
