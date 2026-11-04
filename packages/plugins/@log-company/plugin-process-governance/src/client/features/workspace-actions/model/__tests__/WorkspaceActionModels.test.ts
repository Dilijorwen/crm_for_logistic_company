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
import {
  LogisticsWorkspaceNewRunActionModel,
  LogisticsWorkspaceNewShipmentActionModel,
  LogisticsWorkspaceRecordFieldModel,
} from '../WorkspaceActionModels';

describe('workspace native source actions', () => {
  it('creates source records without passing the composite view key to a create form', () => {
    const engine = new FlowEngine();
    const run = engine.createModel({ use: LogisticsWorkspaceNewRunActionModel });
    const shipment = engine.createModel({ use: LogisticsWorkspaceNewShipmentActionModel });
    shipment.context.defineProperty('blockModel', {
      value: { resource: { getSelectedRows: () => [{ id: '10:100' }, { id: '10:101' }, { id: '11:0' }] } },
    });
    expect(run.context.resourceName).toBe('transport_runs');
    expect(run.getInputArgs()).toMatchObject({
      collectionName: 'transport_runs',
      filterByTk: null,
      associationName: null,
    });
    expect(shipment.context.resourceName).toBe('shipments');
    expect(shipment.getInputArgs()).toMatchObject({
      collectionName: 'shipments',
      filterByTk: null,
      formData: { runs: [{ id: '10' }, { id: '11' }] },
    });
  });

  it('opens the common popup from the main row and from the run association table', async () => {
    const engine = new FlowEngine();
    const main = engine.createModel({ use: LogisticsWorkspaceRecordFieldModel });
    main.context.defineProperty('record', { value: { id: '10:100' } });
    const mainClick = vi.spyOn(main, 'dispatchEvent').mockResolvedValue([]);
    main.onClick({ type: 'click' });
    expect(mainClick).toHaveBeenCalledWith(
      'click',
      expect.objectContaining({ collectionName: 'logistics_work_items', filterByTk: '10:100', navigation: false }),
      { debounce: false, useCache: false },
    );
    await main.onClick({ type: 'click' });
    expect(mainClick).toHaveBeenCalledTimes(2);
    const nested = engine.createModel({ use: LogisticsWorkspaceRecordFieldModel });
    nested.context.defineProperty('record', { value: { id: 100 } });
    nested.context.defineProperty('blockModel', { value: { resource: { getSourceId: () => '10' } } });
    const nestedClick = vi.spyOn(nested, 'dispatchEvent').mockResolvedValue([]);
    nested.onClick({ type: 'click' });
    expect(nestedClick).toHaveBeenCalledWith(
      'click',
      expect.objectContaining({ filterByTk: '10:100', sourceId: null, associationName: null }),
      { debounce: false, useCache: false },
    );
  });

  it('does not open a popup for invalid row keys', () => {
    const model = new FlowEngine().createModel({ use: LogisticsWorkspaceRecordFieldModel });
    model.context.defineProperty('record', { value: { id: 'invalid' } });
    const dispatch = vi.spyOn(model, 'dispatchEvent').mockResolvedValue([]);
    model.onClick({ type: 'click' });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('opens the exact shipment as a source record rather than a composite run row', async () => {
    const model = new FlowEngine().createModel({ use: LogisticsWorkspaceRecordFieldModel });
    model.context.defineProperty('record', { value: { id: '10:101' } });
    model.context.defineProperty('collectionField', { value: { name: 'shipment_number' } });
    const dispatch = vi.spyOn(model, 'dispatchEvent').mockResolvedValue([]);
    await model.onClick({ type: 'click' });
    expect(dispatch).toHaveBeenCalledWith(
      'click',
      expect.objectContaining({
        filterByTk: '101',
        workspaceRunId: '10',
        workspaceShipmentId: '101',
        collectionName: 'shipments',
      }),
      { debounce: false, useCache: false },
    );
  });

  it('automatically links a new shipment to the current run rather than selected shipment rows', () => {
    const model = new FlowEngine().createModel({ use: LogisticsWorkspaceNewShipmentActionModel });
    model.context.defineProperty('blockModel', {
      value: { resource: { getSelectedRows: () => [{ id: 100 }], getSourceId: () => '10' } },
    });
    expect(model.getInputArgs()).toMatchObject({
      sourceId: null,
      associationName: null,
      workspaceRunId: '10',
      formData: { runs: [{ id: '10' }] },
    });
  });

  it('uses the explicit run anchor when a nested popup has lost its association source', () => {
    const model = new FlowEngine().createModel({ use: LogisticsWorkspaceNewShipmentActionModel });
    model.context.defineProperty('view', {
      value: { inputArgs: { collectionName: 'logistics_work_items', filterByTk: '10:100', workspaceRunId: '10' } },
    });
    expect(model.getInputArgs()).toMatchObject({ formData: { runs: [{ id: '10' }] } });
  });
});
