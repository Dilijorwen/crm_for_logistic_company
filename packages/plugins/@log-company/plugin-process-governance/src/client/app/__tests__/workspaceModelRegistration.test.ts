/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Application, BulkDeleteActionModel } from '@nocobase/client';
import { createViewScopedEngine, ErrorFlowModel } from '@nocobase/flow-engine';
import { describe, expect, it } from 'vitest';
import { PluginProcessGovernanceClient } from '../plugin';

describe('workspace model registration', () => {
  it('makes card models available to an existing view engine before plugin load', async () => {
    const app = new Application();
    const view = createViewScopedEngine(app.flowEngine);
    const classes = [
      'LogisticsWorkspaceCreateFormModel',
      'LogisticsWorkspaceShipmentSubformModel',
      'LogisticsWorkspaceScopedSelectFieldModel',
      'LogisticsWorkspaceRunDocumentsModel',
      'LogisticsWorkspaceShipmentFieldsGridModel',
      'LogisticsWorkspaceOpenDeletionActionModel',
    ];

    await app.pm.add(PluginProcessGovernanceClient);

    for (const name of classes) {
      expect(view.getModelClass(name), name).toBeDefined();
    }
    const documents = view.createModel({
      uid: 'lcwscreaterungriddocuments',
      use: 'LogisticsWorkspaceRunDocumentsModel',
    });
    expect(documents).not.toBeInstanceOf(ErrorFlowModel);
    expect(view.getModel(documents.uid)).toBe(documents);
  });
  it('does not redefine the stock NocoBase delete action', async () => {
    const original = BulkDeleteActionModel.meta;
    const app = new Application();
    await app.pm.add(PluginProcessGovernanceClient);
    await app.pm.load();
    expect(BulkDeleteActionModel.meta).toBe(original);
  });
});
