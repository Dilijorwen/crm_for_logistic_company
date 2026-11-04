/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { FlowEngine } from '@nocobase/flow-engine';
import { describe, expect, it, vi } from 'vitest';
import { LogisticsWorkspaceAddActionModel } from '../WorkspaceAddActionModel';
import { LogisticsWorkspaceNewRunActionModel } from '../../model/WorkspaceActionModels';

describe('workspace single add action', () => {
  it('creates only a run and never copies selected shipment context', async () => {
    const model = new FlowEngine().createModel({ use: LogisticsWorkspaceAddActionModel });
    model.context.defineProperty('blockModel', {
      value: { resource: { getSelectedRows: () => [{ id: '10:100' }] } },
    });
    model.context.defineProperty('view', {
      value: { inputArgs: { filterByTk: '10:100', workspaceShipmentId: '100' } },
    });
    expect(model).toBeInstanceOf(LogisticsWorkspaceNewRunActionModel);
    expect(model.context.resourceName).toBe('transport_runs');
    expect(model.getInputArgs()).toMatchObject({
      collectionName: 'transport_runs',
      filterByTk: null,
      sourceId: null,
      associationName: null,
      workspaceRunId: null,
      workspaceShipmentId: null,
      formData: {},
    });
    const dispatch = vi.spyOn(model, 'dispatchEvent').mockResolvedValue([]);
    await model.onClick({ type: 'click' });
    expect(dispatch).toHaveBeenCalledWith(
      'click',
      expect.objectContaining({ collectionName: 'transport_runs', filterByTk: null }),
      expect.any(Object),
    );
  });
});
