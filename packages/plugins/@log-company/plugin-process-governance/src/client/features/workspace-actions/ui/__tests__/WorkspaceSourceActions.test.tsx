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
import { Application, TableBlockModel, confirm } from '@nocobase/client';
import { FlowEngineGlobalsContextProvider, FlowEngineProvider, FlowModel } from '@nocobase/flow-engine';
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWorkspaceRunPermissions } from '../../model/useWorkspaceRunPermissions';
import { LogisticsWorkspaceDisassociateActionModel } from '../WorkspaceShipmentActions';
import { WorkspaceShipmentDetachButton } from '../WorkspaceShipmentDetachButton';
import { LogisticsWorkspaceCreateFormModel } from '../../../synchronize-shipment-form';

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

describe('FlowEngine permissions and shared native detach action', () => {
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
});
