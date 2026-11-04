/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Application, DataBlockModel, EditFormModel, FormGridModel } from '@nocobase/client';
import { AddSubModelButton, FlowEngineProvider, FlowModel } from '@nocobase/flow-engine';
import { act, render, screen, userEvent, waitFor } from '@nocobase/test/client';
import { App } from 'antd';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { PluginProcessGovernanceClient } from '../../../../app/plugin';
import { LogisticsWorkspaceShipmentEditFormModel } from '../WorkspaceShipmentEditFormModel';

async function createScenario() {
  const app = new Application();
  const engine = app.flowEngine;
  engine.context.defineProperty('app', { value: app });
  engine.context.defineProperty('view', {
    value: { inputArgs: { dataSourceKey: 'main', collectionName: 'shipments', filterByTk: '100' } },
  });
  engine.context.dataSourceManager.getDataSource('main')?.addCollection({
    name: 'shipments',
    filterTargetKey: 'id',
    fields: [{ name: 'id', type: 'string', interface: 'input' }],
  });
  engine.registerModels({ DataBlockModel, EditFormModel, FormGridModel });
  await new PluginProcessGovernanceClient({}, app).load();
  return engine;
}

describe('workspace shipment form registration', () => {
  it('shows a single edit form in the add block menu', async () => {
    const engine = await createScenario();
    engine.flowSettings.forceEnable();
    const parent = engine.createModel({ use: FlowModel });
    render(
      <FlowEngineProvider engine={engine}>
        <App>
          <AddSubModelButton model={parent} subModelKey="items" subModelBaseClass={DataBlockModel}>
            <button>Добавить блок</button>
          </AddSubModelButton>
        </App>
      </FlowEngineProvider>,
    );

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Добавить блок' }));
    });

    await waitFor(() => expect(screen.getAllByText('Form (Edit)')).toHaveLength(1));
  });

  it('loads an existing workspace shipment form and preserves its configured grid', async () => {
    const engine = await createScenario();
    const model = engine.createModel<LogisticsWorkspaceShipmentEditFormModel>({
      uid: 'existing-workspace-shipment-form',
      use: 'LogisticsWorkspaceShipmentEditFormModel',
      stepParams: {
        resourceSettings: { init: { dataSourceKey: 'main', collectionName: 'shipments', filterByTk: '100' } },
      },
      subModels: {
        grid: { uid: 'existing-shipment-grid', use: 'LogisticsWorkspaceShipmentSectionsGridModel' },
      },
    });

    expect(model).toBeInstanceOf(LogisticsWorkspaceShipmentEditFormModel);
    expect(model.subModels.grid.uid).toBe('existing-shipment-grid');
    expect(model.getAclActionName()).toBe('update');
    expect(model.getResourceSettingsInitParams()).toMatchObject({ collectionName: 'shipments', filterByTk: '100' });
    expect(model.serialize()).toMatchObject({
      use: 'LogisticsWorkspaceShipmentEditFormModel',
      subModels: {
        grid: { uid: 'existing-shipment-grid', use: 'LogisticsWorkspaceShipmentSectionsGridModel' },
      },
    });
  });
});
