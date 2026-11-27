/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { App, ConfigProvider, Form } from 'antd';
import { Application, PluginFlowEngine, TableBlockModel, confirm } from '@nocobase/client';
import {
  FlowEngineGlobalsContextProvider,
  FlowEngineProvider,
  FlowModel,
  FlowModelRenderer,
} from '@nocobase/flow-engine';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useWorkspaceRunPermissions } from '../../model/useWorkspaceRunPermissions';
import { LogisticsWorkspaceOpenDeletionActionModel } from '../../model/WorkspaceOpenDeletionActionModel';
import { LogisticsWorkspaceDisassociateActionModel } from '../WorkspaceShipmentActions';
import { WorkspaceShipmentDetachButton } from '../WorkspaceShipmentDetachButton';
import {
  LogisticsWorkspaceCreateFormModel,
  LogisticsWorkspaceScopedSelectFieldModel,
  LogisticsWorkspaceShipmentFieldsGridModel,
  ShipmentSynchronizedEditFormModel,
} from '../../../synchronize-shipment-form';
import {
  LogisticsWorkspaceShipmentFoldGridModel,
  LogisticsWorkspaceShipmentSubformModel,
} from '../../../synchronize-shipment-form/model/WorkspaceShipmentSubformModel';

function fixture() {
  const engine = new Application().flowEngine;
  engine.registerModels({ TableBlockModel, LogisticsWorkspaceDisassociateActionModel });
  engine.registerActions({ confirm });
  const source = engine.context.dataSourceManager.getDataSource('main');
  source?.addCollection({
    name: 'shipments',
    filterTargetKey: 'id',
    fields: [{ name: 'id', type: 'bigInt', interface: 'integer' }],
  });
  source?.addCollection({
    name: 'transport_runs',
    filterTargetKey: 'id',
    fields: [
      { name: 'id', type: 'bigInt', interface: 'integer' },
      { name: 'shipments', type: 'belongsToMany', interface: 'm2m', target: 'shipments' },
    ],
  });
  engine.context.acl.setData({ allowAll: true });
  const host = engine.createModel({ use: FlowModel });
  return { engine, host };
}

async function mountUnifiedForm({ withFold = false, editing = false, withContract = false, restricted = false } = {}) {
  const app = new Application();
  const engine = app.flowEngine;
  await new PluginFlowEngine({}, app).load();
  engine.registerModels({
    EditFormModel: ShipmentSynchronizedEditFormModel,
    LogisticsWorkspaceCreateFormModel,
    LogisticsWorkspaceShipmentSubformModel,
    LogisticsWorkspaceShipmentFoldGridModel,
    LogisticsWorkspaceShipmentFieldsGridModel,
    LogisticsWorkspaceScopedSelectFieldModel,
  });
  engine.context.acl.setData(
    restricted
      ? {
          resources: ['shipments', 'transport_runs'],
          actions: {
            'transport_runs:create': { fields: ['shipments'] },
            'transport_runs:update': { fields: ['shipments'] },
            'transport_runs:view': { fields: ['shipments'] },
            'shipments:create': { fields: ['invoice_number', 'status'] },
            'shipments:update': { fields: ['invoice_number', 'status'] },
            'shipments:view': { fields: ['invoice_number', 'status', 'shipment_number'] },
          },
        }
      : { allowAll: true },
  );
  engine.context.defineProperty('flowSettingsEnabled', { value: false });
  engine.context.defineProperty('view', {
    value: {
      inputArgs: { dataSourceKey: 'main', collectionName: 'transport_runs', ...(editing ? { filterByTk: '10' } : {}) },
    },
  });
  const source = engine.context.dataSourceManager.getDataSource('main');
  source?.addCollection({
    name: 'shipments',
    filterTargetKey: 'id',
    fields: [
      { name: 'id', type: 'bigInt', interface: 'integer' },
      { name: 'shipment_number', type: 'integer', interface: 'integer' },
      { name: 'invoice_number', type: 'string', interface: 'input', uiSchema: { title: 'Инвойс' } },
    ],
  });
  if (restricted) {
    source?.addCollection({
      name: 'customs_warehouses',
      filterTargetKey: 'id',
      fields: [{ name: 'id', type: 'bigInt', interface: 'integer' }],
    });
    source?.getCollection('shipments')?.addField({
      name: 'customs_warehouse',
      type: 'belongsTo',
      interface: 'm2o',
      target: 'customs_warehouses',
      targetKey: 'id',
      uiSchema: { title: 'СВХ' },
    });
  }
  source?.addCollection({
    name: 'transport_runs',
    filterTargetKey: 'id',
    fields: [
      { name: 'id', type: 'bigInt', interface: 'integer' },
      {
        name: 'shipments',
        type: 'belongsToMany',
        interface: 'm2m',
        target: 'shipments',
        targetKey: 'id',
        uiSchema: { title: 'Поставки' },
      },
    ],
  });
  const field = (fieldPath: string) => ({
    dataSourceKey: 'main',
    collectionName: 'transport_runs',
    fieldPath,
  });
  const contractInput = {
    uid: 'unified-test-contract-input',
    use: 'LogisticsWorkspaceScopedSelectFieldModel',
    stepParams: {
      selectSettings: {
        dataScope: {
          filter: {
            logic: '$and',
            items: [
              { path: 'importers.id', operator: '$eq', value: '{{ ctx.item.value.company.id }}' },
              { path: 'importers.id', operator: '$notEmpty', value: true },
              { path: 'is_active', operator: '$isTruly', value: true },
            ],
          },
        },
      },
    },
  };
  const contractItem = {
    uid: 'unified-test-contract',
    use: 'FormItemModel',
    stepParams: { fieldSettings: { init: field('shipments.contract_record') } },
    subModels: { field: contractInput },
  };
  if (withContract) {
    source?.addCollection({
      name: 'our_companies',
      filterTargetKey: 'id',
      fields: [{ name: 'id', type: 'bigInt', interface: 'integer' }],
    });
    source?.addCollection({
      name: 'contracts',
      filterTargetKey: 'id',
      titleField: 'name',
      fields: [
        { name: 'id', type: 'bigInt', interface: 'integer' },
        { name: 'name', type: 'string', interface: 'input' },
        { name: 'is_active', type: 'boolean', interface: 'checkbox' },
        { name: 'importers', type: 'belongsToMany', interface: 'm2m', target: 'our_companies', targetKey: 'id' },
      ],
    });
    const shipments = source?.getCollection('shipments');
    shipments?.addField({
      name: 'company',
      type: 'belongsTo',
      interface: 'm2o',
      target: 'our_companies',
      targetKey: 'id',
    });
    shipments?.addField({
      name: 'contract_record',
      type: 'belongsTo',
      interface: 'm2o',
      target: 'contracts',
      targetKey: 'id',
      uiSchema: { title: 'Контракт', 'x-component-props': { fieldNames: { label: 'name', value: 'id' } } },
    });
  }
  const invoiceField = {
    use: 'FormItemModel',
    stepParams: {
      fieldSettings: { init: field('shipments.invoice_number') },
      editItemSettings: { required: { required: true } },
    },
    subModels: { field: { use: 'InputFieldModel' } },
  };
  const editorFields = withFold
    ? [
        {
          use: 'LogisticsWorkspaceShipmentFoldGridModel',
          props: { workspaceSectionTitle: 'Инвойс и товары' },
          subModels: { items: [invoiceField] },
        },
      ]
    : [invoiceField, ...(withContract ? [contractItem] : [])];
  if (restricted) {
    editorFields.push({
      use: 'LogisticsWorkspaceShipmentFoldGridModel',
      props: { workspaceSectionTitle: 'Таможенное оформление' },
      subModels: {
        items: [
          {
            use: 'FormItemModel',
            stepParams: { fieldSettings: { init: field('shipments.customs_warehouse') } },
            subModels: { field: { use: 'LogisticsWorkspaceScopedSelectFieldModel' } },
          },
        ],
      },
    });
  }
  const pickerUid = 'unified-test-shipment-field';
  engine.setModelRepository({
    findOne: vi.fn(async (query) =>
      query?.parentId === pickerUid && query?.subKey === 'grid-block'
        ? {
            uid: 'native-shipment-picker',
            use: 'BlockGridModel',
            subModels: {
              items: [
                {
                  use: 'TableSelectModel',
                  stepParams: { resourceSettings: { init: { dataSourceKey: 'main', collectionName: 'shipments' } } },
                  subModels: {
                    columns: [
                      {
                        use: 'TableColumnModel',
                        stepParams: {
                          fieldSettings: {
                            init: { dataSourceKey: 'main', collectionName: 'shipments', fieldPath: 'invoice_number' },
                          },
                        },
                        subModels: { field: { use: 'DisplayTextFieldModel' } },
                      },
                    ],
                  },
                },
              ],
            },
          }
        : null,
    ),
    save: vi.fn(),
    destroy: vi.fn(),
    move: vi.fn(),
    duplicate: vi.fn(),
  });
  const model = engine.createModel<LogisticsWorkspaceCreateFormModel | ShipmentSynchronizedEditFormModel>({
    use: editing ? 'EditFormModel' : 'LogisticsWorkspaceCreateFormModel',
    props: { workspaceUnified: true },
    stepParams: {
      resourceSettings: {
        init: { dataSourceKey: 'main', collectionName: 'transport_runs', ...(editing ? { filterByTk: '10' } : {}) },
      },
    },
    subModels: {
      actions: [
        {
          use: 'FormSubmitActionModel',
          stepParams: { buttonSettings: { general: { title: 'Сохранить рейс', type: 'primary' } } },
        },
      ],
      grid: {
        use: 'FormGridModel',
        subModels: {
          items: [
            {
              use: 'FormItemModel',
              stepParams: { fieldSettings: { init: field('shipments') } },
              subModels: {
                field: {
                  uid: pickerUid,
                  use: 'LogisticsWorkspaceShipmentSubformModel',
                  stepParams: {
                    subFormListSettings: { allowSelectExistingRecord: { allowSelectExistingRecord: true } },
                    selectExitRecordSettings: { openView: { mode: 'dialog', size: 'large' } },
                  },
                  subModels: {
                    grid: {
                      use: 'LogisticsWorkspaceShipmentFieldsGridModel',
                      subModels: { items: editorFields },
                    },
                  },
                },
              },
            },
          ],
        },
      },
    },
  });
  const request = vi.spyOn(engine.context.api, 'request').mockImplementation(async (config) => {
    const url = String(config.url);
    if (url.includes('contracts:list')) {
      return { data: { data: [], meta: { count: 0, page: 1, pageSize: 40 } } };
    }
    const selectedShipment = {
      id: editing ? '103' : '101',
      shipment_number: editing ? 23 : 21,
      invoice_number: editing ? 'INV-THIRD' : 'INV-EXISTING',
    };
    if (url.includes('shipments:list')) {
      return { data: { data: [selectedShipment], meta: { count: 1, page: 1, pageSize: 20 } } };
    }
    if (url.includes('shipments:get')) {
      return {
        data: {
          data: {
            ...selectedShipment,
            company: { id: '51', name: 'Импортер' },
            contract_record: { id: '61', name: 'Контракт' },
            manager_comment: 'Сохранённый комментарий',
          },
        },
      };
    }
    if (url.includes('transport_runs:get')) {
      return {
        data: {
          data: {
            id: '10',
            shipments: [
              { id: '101', shipment_number: 21, invoice_number: 'INV-EXISTING' },
              { id: '102', shipment_number: 22, invoice_number: 'INV-KEEP' },
            ],
          },
          meta: { currentFilterByTk: '10' },
        },
      };
    }
    return { data: { data: { id: '10' } } };
  });
  render(
    <App>
      <FlowEngineProvider engine={engine}>
        <FlowEngineGlobalsContextProvider>
          <FlowModelRenderer model={model} />
        </FlowEngineGlobalsContextProvider>
      </FlowEngineProvider>
    </App>,
  );
  return { model, request };
}

describe('FlowEngine permissions and shared native detach action', () => {
  it.each(['transport_runs', 'shipments'])('opens the deletion page with delete permission on %s', async (resource) => {
    const app = new Application();
    await new PluginFlowEngine({}, app).load();
    const engine = app.flowEngine;
    engine.context.acl.setMeta({
      dataSources: { main: { resources: [resource], actions: { [`${resource}:destroy`]: {} } } },
    });
    const model = engine.createModel({ use: LogisticsWorkspaceOpenDeletionActionModel });
    model.context.defineProperty('resourceName', { value: 'logistics_work_items' });
    render(
      <MemoryRouter>
        <FlowEngineProvider engine={engine}>
          <FlowEngineGlobalsContextProvider>
            <Routes>
              <Route path="/" element={<FlowModelRenderer model={model} />} />
              <Route path="/admin/logistics-delete" element={<h2>Удаление рейсов и поставок</h2>} />
            </Routes>
          </FlowEngineGlobalsContextProvider>
        </FlowEngineProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Удалить рейсы и поставки' }));
    expect(await screen.findByRole('heading', { name: 'Удаление рейсов и поставок' })).toBeVisible();
  });

  it('does not render a deletion button for a role with read-only access', async () => {
    const app = new Application();
    await new PluginFlowEngine({}, app).load();
    const engine = app.flowEngine;
    engine.context.acl.setData({ strategy: { actions: ['view'] } });
    const model = engine.createModel({ use: LogisticsWorkspaceOpenDeletionActionModel });
    model.context.defineProperty('resourceName', { value: 'logistics_work_items' });

    await model.dispatchEvent('beforeRender');
    render(<MemoryRouter>{model.render()}</MemoryRouter>);

    expect(screen.queryByRole('button', { name: 'Удалить рейсы и поставки' })).not.toBeInTheDocument();
  });

  it('allows the native administrator without the legacy ACL React provider', async () => {
    const { host } = fixture();
    const { result } = renderHook(() => useWorkspaceRunPermissions(host, '10'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ canCreate: true, canAssociate: true });
  });

  it('keeps create and association field permissions separate', async () => {
    const { engine, host } = fixture();
    engine.context.acl.setData({
      resources: ['shipments', 'transport_runs'],
      actions: { 'transport_runs:update': { fields: ['shipments'] } },
    });
    const { result } = renderHook(() => useWorkspaceRunPermissions(host, '10'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ canCreate: false, canAssociate: true });
    const denied = fixture();
    denied.engine.context.acl.setData({});
    const { result: blocked } = renderHook(() => useWorkspaceRunPermissions(denied.host, '10'));
    await waitFor(() => expect(blocked.current.loading).toBe(false));
    expect(blocked.current).toMatchObject({ canCreate: false, canAssociate: false });
  });

  it('renders a working detach icon in the sidebar and removes only the current run association', async () => {
    const { engine, host } = fixture();
    const request = vi.spyOn(engine.context.api, 'request').mockResolvedValue({ data: { data: [], meta: {} } });
    const baseline = new Set<string>();
    engine.forEachModel((model) => baseline.add(model.uid));
    const rendered = render(
      <ConfigProvider>
        <App>
          <FlowEngineProvider engine={engine}>
            <FlowEngineGlobalsContextProvider>
              <WorkspaceShipmentDetachButton host={host} runId="10" shipmentId="101" />
            </FlowEngineGlobalsContextProvider>
          </FlowEngineProvider>
        </App>
      </ConfigProvider>,
    );
    const button = await screen.findByRole('button', { name: 'Отвязать' });
    await waitFor(() => expect(button).not.toBeDisabled());
    const confirmation = vi.fn(async () => true);
    engine.context.defineProperty('modal', { value: { confirm: confirmation } });
    fireEvent.click(button);
    await waitFor(() =>
      expect(request.mock.calls.some(([config]) => String(config.url).includes('shipments:remove'))).toBe(true),
    );
    const mutation = request.mock.calls.find(([config]) => String(config.url).includes('shipments:remove'))?.[0];
    expect(mutation?.url).toContain('transport_runs/10/shipments:remove');
    expect(JSON.stringify(mutation)).toContain('101');
    expect(request.mock.calls.some(([config]) => String(config.url).includes(':destroy'))).toBe(false);
    expect(confirmation).toHaveBeenCalledOnce();
    rendered.unmount();
    const remaining = new Set<string>();
    engine.forEachModel((model) => remaining.add(model.uid));
    expect(remaining).toEqual(baseline);
  });

  it('submits the native create form with its run even when the run selector is not rendered', async () => {
    const { engine } = fixture();
    const request = vi.spyOn(engine.context.api, 'request').mockResolvedValue({ data: { data: { id: '101' } } });
    const formHook = renderHook(() => Form.useForm());
    const form = formHook.result.current[0];
    render(
      <Form form={form} initialValues={{ runs: [{ id: '10' }], chinese_client: { id: '1' }, company: { id: '2' } }} />,
    );
    const model = engine.createModel({
      use: LogisticsWorkspaceCreateFormModel,
      stepParams: { resourceSettings: { init: { dataSourceKey: 'main', collectionName: 'shipments' } } },
    });
    model.context.defineProperty('form', { value: form });
    model.context.defineProperty('view', { value: { inputArgs: { collectionName: 'shipments' } } });
    const linked = engine.createModel({
      use: TableBlockModel,
      stepParams: {
        resourceSettings: {
          init: {
            dataSourceKey: 'main',
            collectionName: 'shipments',
            associationName: 'transport_runs.shipments',
            sourceId: '10',
          },
        },
      },
    });
    linked.resource.setSourceId('10');
    const refresh = vi.spyOn(linked.resource, 'refresh').mockResolvedValue(undefined);
    await model.submit();
    const create = request.mock.calls.find(([config]) => String(config.url).includes('shipments:create'))?.[0];
    expect(create).toBeDefined();
    expect(JSON.stringify(create?.data)).toContain('"runs":[{"id":"10"}]');
    expect(refresh).toHaveBeenCalledOnce();
  });

  async function selectShipmentAction(label: string) {
    fireEvent.click(await screen.findByRole('button', { name: /Добавить поставку/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: label }));
  }

  it('keeps invalid shipment rows on their own tabs and saves both when corrected', async () => {
    const { model, request } = await mountUnifiedForm();
    await screen.findByText('Поставок пока нет');
    await selectShipmentAction('Создать новую поставку');
    await selectShipmentAction('Создать новую поставку');
    await screen.findByRole('tab', { name: 'Новая поставка 2' });
    expect(model.form.getFieldValue('shipments')).toEqual([
      expect.objectContaining({ status: 'queue' }),
      expect.objectContaining({ status: 'queue' }),
    ]);
    await act(async () => {
      await expect(model.submit()).rejects.toBeDefined();
    });
    expect(request.mock.calls.some(([config]) => String(config.url).includes('transport_runs:create'))).toBe(false);
    fireEvent.click(screen.getByRole('tab', { name: 'Новая поставка 1' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'INV-10' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Новая поставка 2' }));
    const secondInvoice = await screen.findByRole('textbox');
    fireEvent.change(secondInvoice, { target: { value: 'INV-20' } });
    await model.submit();
    const create = request.mock.calls.find(([config]) => String(config.url).includes('transport_runs:create'))?.[0];
    expect(create?.params).toMatchObject({ workspaceUnified: true });
    expect(create?.params?.updateAssociationValues).toContain('shipments');
    expect(create?.data).toMatchObject({
      shipments: [
        { invoice_number: 'INV-10', status: 'queue' },
        { invoice_number: 'INV-20', status: 'queue' },
      ],
    });
  });

  it.each([false, true])('submits the current shipment tabs through the toolbar (editing=%s)', async (editing) => {
    const { model, request } = await mountUnifiedForm({ editing, restricted: true });
    await selectShipmentAction('Привязать существующую');
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(
      within(await within(dialog).findByRole('row', { name: editing ? /INV-THIRD/ : /INV-EXISTING/ })).getByRole(
        'checkbox',
      ),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await screen.findByRole('tab', { name: editing ? '№23' : '№21' });
    for (const invoice of ['INV-NEW-1', 'INV-NEW-2', 'INV-NEW-3']) {
      await selectShipmentAction('Создать новую поставку');
      fireEvent.change(await screen.findByRole('textbox'), { target: { value: invoice } });
    }
    for (let index = editing ? 0 : 1; index < (editing ? 3 : 4); index++) {
      model.form.setFieldValue(['shipments', index, 'customs_warehouse'], { id: '99' });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить рейс' }));
    const action = editing ? 'transport_runs:update' : 'transport_runs:create';
    await waitFor(() => expect(request.mock.calls.some(([config]) => String(config.url).includes(action))).toBe(true));
    const save = request.mock.calls.find(([config]) => String(config.url).includes(action))?.[0];
    expect(save?.data?.shipments).toEqual([
      ...(editing ? [{ id: '101' }, { id: '102' }] : []),
      { id: editing ? '103' : '101' },
      ...['INV-NEW-1', 'INV-NEW-2', 'INV-NEW-3'].map((invoice_number) =>
        expect.objectContaining({ invoice_number, status: 'queue' }),
      ),
    ]);
    expect(save?.data?.shipments.some((row: Record<string, unknown>) => 'customs_warehouse' in row)).toBe(false);
  });

  it('keeps fields in a collapsed section connected to the native run form', async () => {
    const { model } = await mountUnifiedForm({ withFold: true });
    await selectShipmentAction('Создать новую поставку');
    const section = await screen.findByRole('button', { name: /Инвойс и товары/ });
    expect(section).toHaveAttribute('aria-expanded', 'false');
    await act(async () => {
      await expect(model.submit()).rejects.toBeDefined();
    });
    fireEvent.click(section);
    const invoice = await screen.findByRole('textbox');
    fireEvent.change(invoice, { target: { value: 'INV-FOLD' } });
    fireEvent.click(section);
    expect(model.form.getFieldValue(['shipments', 0, 'invoice_number'])).toBe('INV-FOLD');
  });

  it('filters contracts by the importer of each shipment in the native selector', async () => {
    const { model, request } = await mountUnifiedForm({ withContract: true });
    await selectShipmentAction('Создать новую поставку');
    await selectShipmentAction('Создать новую поставку');
    const filters = () =>
      request.mock.calls
        .filter(([config]) => String(config.url).includes('contracts:list'))
        .map(([config]) => JSON.parse(String(config.params?.filter)));
    function expectedFilter(importer: string | null) {
      return {
        $and: [
          {
            $and: [
              { importers: { id: { $eq: importer } } },
              { importers: { id: { $notEmpty: true } } },
              { is_active: { $isTruly: true } },
            ],
          },
        ],
      };
    }

    fireEvent.mouseDown(await screen.findByRole('combobox'));
    await waitFor(() => expect(filters()).toContainEqual(expectedFilter(null)));
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape', code: 'Escape', keyCode: 27 });
    act(() => {
      model.form.setFieldValue(['shipments', 0, 'company'], { id: '51' });
      model.form.setFieldValue(['shipments', 1, 'company'], { id: '52' });
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Новая поставка 1' }));
    fireEvent.mouseDown(await screen.findByRole('combobox'));
    await waitFor(() => expect(filters()).toContainEqual(expectedFilter('51')));
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape', code: 'Escape', keyCode: 27 });
    fireEvent.click(screen.getByRole('tab', { name: 'Новая поставка 2' }));
    fireEvent.mouseDown(await screen.findByRole('combobox'));
    await waitFor(() => expect(filters()).toContainEqual(expectedFilter('52')));
  });

  it.each([
    { scenario: 'as a link', invoice: undefined, expected: { id: '101' } },
    {
      scenario: 'with an intentional edit',
      invoice: 'INV-CHANGED',
      expected: { id: '101', invoice_number: 'INV-CHANGED' },
    },
  ])('saves an existing shipment in the native modal $scenario', async ({ invoice, expected }) => {
    const { model, request } = await mountUnifiedForm({ withContract: true });
    await selectShipmentAction('Привязать существующую');
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveClass('ant-modal');
    const row = await within(dialog).findByRole('row', { name: /INV-EXISTING/ });
    fireEvent.click(within(row).getByRole('checkbox'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await screen.findByRole('tab', { name: '№21' });
    expect(model.form.getFieldValue(['shipments', 0])).toMatchObject({
      company: { id: '51' },
      contract_record: { id: '61' },
      manager_comment: 'Сохранённый комментарий',
    });
    if (invoice) fireEvent.change(await screen.findByRole('textbox'), { target: { value: invoice } });
    await model.submit();
    const create = request.mock.calls.find(([config]) => String(config.url).includes('transport_runs:create'))?.[0];
    expect(create?.data?.shipments).toEqual([expected]);
  });

  it('removes a draft from the toolbar without losing another shipment’s values', async () => {
    const { model, request } = await mountUnifiedForm();
    await selectShipmentAction('Создать новую поставку');
    await selectShipmentAction('Создать новую поставку');
    fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'INV-REMAINING' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Новая поставка 1' }));
    fireEvent.click(screen.getByRole('button', { name: /Убрать черновик/ }));
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(await screen.findByRole('textbox')).toHaveValue('INV-REMAINING');
    await model.submit();
    const create = request.mock.calls.find(([config]) => String(config.url).includes('transport_runs:create'))?.[0];
    expect(create?.data).toMatchObject({ shipments: [{ invoice_number: 'INV-REMAINING' }] });
  });

  it('keeps the shipment on cancel and saves the unlink only after confirmation', async () => {
    const { model, request } = await mountUnifiedForm({ editing: true });
    await screen.findByRole('tab', { name: '№21' });
    const detach = screen.getByRole('button', { name: /Отвязать$/ });
    fireEvent.click(detach);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Отвязать поставку №21 от рейса?')).toBeInTheDocument();
    expect(model.form.getFieldValue('_workspaceDetachedShipmentIds')).toBeUndefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(screen.getByRole('tab', { name: '№21' })).toBeInTheDocument();
    expect(model.form.getFieldValue('_workspaceDetachedShipmentIds')).toBeUndefined();

    fireEvent.click(detach);
    const reopened = await screen.findByRole('dialog');
    fireEvent.click(within(reopened).getByRole('button', { name: 'Отвязать' }));
    await waitFor(() => expect(screen.queryByRole('tab', { name: '№21' })).not.toBeInTheDocument());
    expect(screen.getByRole('textbox')).toHaveValue('INV-KEEP');
    expect(request.mock.calls.some(([config]) => /:update|:remove/.test(String(config.url)))).toBe(false);
    await act(async () => {
      await model.submit();
    });
    const update = request.mock.calls.find(([config]) => String(config.url).includes('transport_runs:update'))?.[0];
    expect(update?.params).toMatchObject({ workspaceUnified: true });
    expect(update?.data).toMatchObject({ shipments: [{ id: '102' }], _workspaceDetachedShipmentIds: ['101'] });
    expect(model.form.getFieldValue('_workspaceDetachedShipmentIds')).toBeUndefined();
  });
});
