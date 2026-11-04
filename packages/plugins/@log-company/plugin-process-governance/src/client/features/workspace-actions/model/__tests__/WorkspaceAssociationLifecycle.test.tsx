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
import {
  Application,
  BlockGridModel,
  TableBlockModel,
  TableSelectModel,
  TableColumnModel,
  DisplayTextFieldModel,
} from '@nocobase/client';
import { FlowEngineGlobalsContextProvider, FlowEngineProvider, FlowModel } from '@nocobase/flow-engine';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceShipmentAddButton } from '../../ui/WorkspaceShipmentAddButton';
import { LogisticsWorkspaceAssociateActionModel } from '../../ui/WorkspaceShipmentActions';

function fixture() {
  const engine = new Application().flowEngine;
  engine.registerModels({
    TableBlockModel,
    TableSelectModel,
    TableColumnModel,
    BlockGridModel,
    DisplayTextFieldModel,
    LogisticsWorkspaceAssociateActionModel,
  });
  engine.context.defineProperty('flowSettingsEnabled', { value: false });
  engine.context.acl.setData({ allowAll: true });
  const source = engine.context.dataSourceManager.getDataSource('main');
  source?.addCollection({
    name: 'shipments',
    filterTargetKey: 'id',
    fields: [
      { name: 'id', type: 'bigInt', interface: 'integer' },
      { name: 'invoice_number', type: 'string', interface: 'input', uiSchema: { title: 'Инвойс' } },
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
  const grid = {
    uid: 'saved-selector-grid',
    use: 'BlockGridModel',
    parentId: 'lcwsrsassociate',
    subKey: 'associate-selector-grid',
    subType: 'object',
    subModels: {
      items: [
        {
          uid: 'saved-selector-table',
          use: 'TableSelectModel',
          stepParams: {
            resourceSettings: { init: { dataSourceKey: 'main', collectionName: 'shipments' } },
          },
          subModels: {
            columns: [
              {
                uid: 'invoice-column',
                use: 'TableColumnModel',
                stepParams: {
                  fieldSettings: {
                    init: { dataSourceKey: 'main', collectionName: 'shipments', fieldPath: 'invoice_number' },
                  },
                },
                subModels: { field: { uid: 'invoice-value', use: 'DisplayTextFieldModel' } },
              },
            ],
          },
        },
      ],
    },
  };
  const findOne = vi.fn(async (query: Record<string, unknown>) =>
    query.uid === 'lcwsrsassociate'
      ? {
          uid: 'lcwsrsassociate',
          use: 'LogisticsWorkspaceAssociateActionModel',
          subModels: { 'associate-selector-grid': grid },
        }
      : query.parentId === 'lcwsrsassociate'
        ? grid
        : null,
  );
  engine.setModelRepository({ findOne, save: vi.fn(), destroy: vi.fn(), move: vi.fn(), duplicate: vi.fn() });
  const request = vi.spyOn(engine.context.api, 'request').mockImplementation(async (config) => ({
    data: String(config.url).includes(':list')
      ? {
          data: [
            { id: '101', invoice_number: 'IN-4590' },
            { id: '102', invoice_number: 'IN-4591' },
          ],
          meta: { count: 2, page: 1, pageSize: 20 },
        }
      : { data: [] },
  }));
  const host = engine.createModel({ use: FlowModel });
  function Section({ active, runId }: { active: boolean; runId: string }) {
    return (
      <ConfigProvider>
        <App>
          <FlowEngineProvider engine={engine}>
            <FlowEngineGlobalsContextProvider>
              {active ? (
                <WorkspaceShipmentAddButton key={runId} host={host} runId={runId} rowId={`${runId}:0`} />
              ) : (
                <p>Документы</p>
              )}
            </FlowEngineGlobalsContextProvider>
          </FlowEngineProvider>
        </App>
      </ConfigProvider>
    );
  }
  const rendered = render(<Section active runId="10" />);
  return { engine, request, findOne, rendered, Section };
}

async function openSelector() {
  const button = await screen.findByRole('button', { name: /Добавить поставку/ });
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.click(button);
  fireEvent.click(await screen.findByText('Привязать существующую'));
  await screen.findByText('IN-4590');
}

describe('standalone native shipment association lifecycle', () => {
  it('opens one selector, binds the current run, cancels and reopens across section remounts', async () => {
    const { engine, request, rendered, Section } = fixture();
    for (const runId of ['10', '11', '10']) {
      rendered.rerender(<Section active={false} runId={runId} />);
      rendered.rerender(<Section active runId={runId} />);
      await openSelector();
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      const selector = engine.getModel<TableSelectModel>('saved-selector-table', true);
      expect(selector?.context.view.inputArgs.sourceId).toBe(runId);
      expect(selector?.rowSelectionProps.type).toBe('checkbox');
      expect(engine.getModel('lcwsrecordpopup', true)).toBeUndefined();
      await act(async () => {
        await selector?.context.view.close();
      });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await waitFor(() => expect(engine.nextEngine).toBeUndefined());
    }
    expect(request.mock.calls.some(([config]) => String(config.url).includes(':add'))).toBe(false);
  });

  it('uses the native association resource and clears the view after confirmation', async () => {
    const { request } = fixture();
    await openSelector();
    const checkbox = within(screen.getByRole('row', { name: /IN-4590/ })).getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Привязать' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const mutation = request.mock.calls.find(([config]) => String(config.url).includes('shipments:add'))?.[0];
    expect(mutation?.url).toContain('transport_runs/10/shipments:add');
    expect(JSON.stringify(mutation?.data)).toContain('101');
  });

  it('shows individual and select-all checkmarks, removes a deselected shipment from the submitted association', async () => {
    const { request } = fixture();
    await openSelector();
    const all = screen.getAllByRole('checkbox')[0];
    const first = within(screen.getByRole('row', { name: /IN-4590/ })).getByRole('checkbox');
    const second = within(screen.getByRole('row', { name: /IN-4591/ })).getByRole('checkbox');
    fireEvent.click(first);
    expect(first).toBeChecked();
    expect(second).not.toBeChecked();
    expect(all).toBePartiallyChecked();
    fireEvent.click(all);
    expect(first).toBeChecked();
    expect(second).toBeChecked();
    expect(all).toBeChecked();
    fireEvent.click(first);
    expect(first).not.toBeChecked();
    expect(second).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Привязать' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const mutation = request.mock.calls.find(([config]) => String(config.url).includes('shipments:add'))?.[0];
    expect(JSON.stringify(mutation?.data)).toContain('102');
    expect(JSON.stringify(mutation?.data)).not.toContain('101');
  });

  it('clears all visible selections when cancelled and reopened, without creating associations', async () => {
    const { request } = fixture();
    await openSelector();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getAllByRole('checkbox').every((checkbox) => (checkbox as HTMLInputElement).checked)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await openSelector();
    for (const checkbox of screen.getAllByRole('checkbox')) expect(checkbox).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Привязать' }));
    await screen.findByText('Выберите хотя бы одну поставку.');
    expect(request.mock.calls.some(([config]) => String(config.url).includes('shipments:add'))).toBe(false);
  });

  it('reports a failed configuration request and allows retry without refreshing the page', async () => {
    const { findOne } = fixture();
    findOne.mockRejectedValueOnce(new Error('network unavailable'));
    const button = await screen.findByRole('button', { name: /Добавить поставку/ });
    fireEvent.click(button);
    fireEvent.click(await screen.findByText('Привязать существующую'));
    await screen.findByText('Не удалось открыть действие с поставками. Повторите попытку.');
    expect(screen.queryByRole('dialog')).toBeNull();
    await openSelector();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('replaces a failed selector grid load with a retry action and then loads the same saved table', async () => {
    const { findOne } = fixture();
    const original = findOne.getMockImplementation();
    if (!original) throw new Error('Missing repository fixture');
    let failed = false;
    findOne.mockImplementation(async (query) => {
      if (query.parentId === 'lcwsrsassociate' && !failed) {
        failed = true;
        throw new Error('selector metadata unavailable');
      }
      return original(query);
    });
    const button = await screen.findByRole('button', { name: /Добавить поставку/ });
    fireEvent.click(button);
    fireEvent.click(await screen.findByText('Привязать существующую'));
    await screen.findByText('Не удалось загрузить поставки.');
    expect(screen.getByRole('button', { name: 'Привязать' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await screen.findByText('IN-4590');
    expect(screen.queryByText('Не удалось загрузить поставки.')).toBeNull();
  });

  it('retains selection after a failed mutation and prevents a duplicate submission', async () => {
    const { request } = fixture();
    await openSelector();
    fireEvent.click(within(screen.getByRole('row', { name: /IN-4590/ })).getByRole('checkbox'));
    expect(within(screen.getByRole('row', { name: /IN-4590/ })).getByRole('checkbox')).toBeChecked();
    const original = request.getMockImplementation();
    if (!original) throw new Error('Missing request fixture');
    let failMutation: (cause: Error) => void = () => {
      throw new Error('Mutation was not started');
    };
    request.mockImplementation((config) =>
      String(config.url).includes('shipments:add')
        ? new Promise((_resolve, reject) => {
            failMutation = reject;
          })
        : original(config),
    );
    const button = screen.getByRole('button', { name: 'Привязать' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() =>
      expect(request.mock.calls.filter(([config]) => String(config.url).includes('shipments:add'))).toHaveLength(1),
    );
    await act(async () => {
      failMutation(new Error('write unavailable'));
    });
    await screen.findByText('Не удалось привязать поставки. Повторите попытку.');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(within(screen.getByRole('row', { name: /IN-4590/ })).getByRole('checkbox')).toBeChecked();
    request.mockImplementation(original);
    fireEvent.click(screen.getByRole('button', { name: 'Привязать' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
