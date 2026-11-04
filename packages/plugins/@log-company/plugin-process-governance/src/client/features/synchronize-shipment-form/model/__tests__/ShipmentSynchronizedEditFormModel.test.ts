/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { CollectionBlockModel } from '@nocobase/client';
import { FlowEngine, MultiRecordResource, SingleRecordResource } from '@nocobase/flow-engine';
import { describe, expect, it, vi } from 'vitest';
import {
  bindShipmentSaveLifecycle,
  refreshShipmentConsumers,
  synchronizeSavedShipment,
} from '../ShipmentSynchronizedEditFormModel';

interface ResourceSettings {
  dataSourceKey: string;
  collectionName: string;
  associationName?: string;
}

function addCollectionModel(
  engine: FlowEngine,
  uid: string,
  settings: ResourceSettings,
  resource: SingleRecordResource | MultiRecordResource,
): void {
  if (settings.associationName) resource.setSourceId('10');
  if (resource instanceof SingleRecordResource) resource.setFilterByTk('10');
  engine.forEachModel = ((callback: (model: CollectionBlockModel) => void) => {
    callback({
      uid,
      context: { resource },
      getResourceSettingsInitParams: () => settings,
    } as unknown as CollectionBlockModel);
  }) as FlowEngine['forEachModel'];
}

describe('refreshShipmentConsumers', () => {
  it('does not query inactive forms or association tables before their IDs are initialized', async () => {
    const engine = new FlowEngine();
    const form = engine.createResource(SingleRecordResource);
    const table = engine.createResource(MultiRecordResource);
    vi.spyOn(form, 'refresh').mockResolvedValue(undefined);
    vi.spyOn(table, 'refresh').mockResolvedValue(undefined);
    engine.forEachModel = ((callback: (value: unknown) => void) => {
      callback({
        context: { resource: form },
        getResourceSettingsInitParams: () => ({ collectionName: 'transport_runs' }),
      });
      callback({
        context: { resource: table },
        getResourceSettingsInitParams: () => ({
          collectionName: 'shipments',
          associationName: 'transport_runs.shipments',
        }),
      });
    }) as FlowEngine['forEachModel'];
    expect(await refreshShipmentConsumers(engine)).toEqual({ refreshed: 0, errors: [] });
    expect(form.refresh).not.toHaveBeenCalled();
    expect(table.refresh).not.toHaveBeenCalled();
  });
  it('refreshes a run shipment table in the same popup and skips the form being saved', async () => {
    const engine = new FlowEngine();
    const savedForm = engine.createResource(SingleRecordResource);
    const linkedTable = engine.createResource(MultiRecordResource);
    linkedTable.setSourceId('10');
    vi.spyOn(savedForm, 'refresh').mockResolvedValue(undefined);
    vi.spyOn(linkedTable, 'refresh').mockResolvedValue(undefined);
    engine.forEachModel = ((callback: (model: CollectionBlockModel) => void) => {
      for (const [collectionName, associationName, resource] of [
        ['transport_runs', undefined, savedForm],
        ['shipments', 'transport_runs.shipments', linkedTable],
      ] as const)
        callback({
          context: { resource },
          getResourceSettingsInitParams: () => ({ dataSourceKey: 'main', collectionName, associationName }),
        } as unknown as CollectionBlockModel);
    }) as FlowEngine['forEachModel'];
    expect(await refreshShipmentConsumers(engine, savedForm)).toEqual({ refreshed: 1, errors: [] });
    expect(linkedTable.refresh).toHaveBeenCalledOnce();
    expect(savedForm.refresh).not.toHaveBeenCalled();
  });
  it('refreshes run records and the run-shipment association from every opener view', async () => {
    const rootEngine = new FlowEngine();
    const runPopupEngine = new FlowEngine();
    const shipmentPopupEngine = new FlowEngine();
    runPopupEngine.linkAfter(rootEngine);
    shipmentPopupEngine.linkAfter(rootEngine);

    const runList = rootEngine.createResource(MultiRecordResource);
    const runForm = runPopupEngine.createResource(SingleRecordResource);
    const shipmentTable = runPopupEngine.createResource(MultiRecordResource);
    runForm.setFilterByTk('10');
    shipmentTable.setSourceId('10');
    vi.spyOn(runList, 'refresh').mockResolvedValue(undefined);
    vi.spyOn(runForm, 'refresh').mockResolvedValue(undefined);
    vi.spyOn(shipmentTable, 'refresh').mockResolvedValue(undefined);

    addCollectionModel(rootEngine, 'run-list', { dataSourceKey: 'main', collectionName: 'transport_runs' }, runList);
    const originalForEachModel = runPopupEngine.forEachModel.bind(runPopupEngine);
    runPopupEngine.forEachModel = ((callback: (model: CollectionBlockModel) => void) => {
      callback({
        uid: 'run-form',
        context: { resource: runForm },
        getResourceSettingsInitParams: () => ({ dataSourceKey: 'main', collectionName: 'transport_runs' }),
      } as unknown as CollectionBlockModel);
      callback({
        uid: 'shipment-table',
        context: { resource: shipmentTable },
        getResourceSettingsInitParams: () => ({
          dataSourceKey: 'main',
          collectionName: 'shipments',
          associationName: 'transport_runs.shipments',
        }),
      } as unknown as CollectionBlockModel);
      originalForEachModel(callback);
    }) as FlowEngine['forEachModel'];

    const result = await refreshShipmentConsumers(shipmentPopupEngine);

    expect(result).toEqual({ refreshed: 3, errors: [] });
    expect(runList.refresh).toHaveBeenCalledOnce();
    expect(runForm.refresh).toHaveBeenCalledOnce();
    expect(shipmentTable.refresh).toHaveBeenCalledOnce();
  });

  it('ignores unrelated collections and reports refresh failures without rejecting the shipment save', async () => {
    const openerEngine = new FlowEngine();
    const shipmentPopupEngine = new FlowEngine();
    shipmentPopupEngine.linkAfter(openerEngine);

    const shipmentTable = openerEngine.createResource(MultiRecordResource);
    const refreshError = new Error('network');
    vi.spyOn(shipmentTable, 'refresh').mockRejectedValue(refreshError);
    addCollectionModel(
      openerEngine,
      'shipment-table',
      {
        dataSourceKey: 'main',
        collectionName: 'shipments',
        associationName: 'transport_runs.shipments',
      },
      shipmentTable,
    );

    await expect(refreshShipmentConsumers(shipmentPopupEngine)).resolves.toEqual({
      refreshed: 0,
      errors: [refreshError],
    });
    expect(shipmentTable.refresh).toHaveBeenCalledOnce();
  });

  it('clears the saved shipment dirty state before every repeated opener synchronization', async () => {
    const events: string[] = [];
    const openerEngine = new FlowEngine();
    const shipmentPopupEngine = new FlowEngine();
    shipmentPopupEngine.linkAfter(openerEngine);
    const runList = openerEngine.createResource(MultiRecordResource);
    vi.spyOn(runList, 'refresh').mockImplementation(async () => {
      events.push('refresh');
    });
    addCollectionModel(openerEngine, 'run-list', { dataSourceKey: 'main', collectionName: 'transport_runs' }, runList);

    const formModel = {
      resetUserModifiedFields: () => events.push('reset'),
    };
    const firstResult = await synchronizeSavedShipment(formModel, shipmentPopupEngine);
    const secondResult = await synchronizeSavedShipment(formModel, shipmentPopupEngine);

    expect(firstResult).toEqual({ refreshed: 1, errors: [] });
    expect(secondResult).toEqual({ refreshed: 1, errors: [] });
    expect(events).toEqual(['reset', 'refresh', 'reset', 'refresh']);
  });
});

describe('bindShipmentSaveLifecycle', () => {
  function createScenario() {
    const events: string[] = [];
    const dirtyFields = new Set<string>();
    const openerEngine = new FlowEngine();
    const shipmentPopupEngine = new FlowEngine();
    shipmentPopupEngine.linkAfter(openerEngine);

    const openerResource = openerEngine.createResource(MultiRecordResource);
    vi.spyOn(openerResource, 'refresh').mockImplementation(async () => {
      events.push('refresh opener');
    });
    addCollectionModel(
      openerEngine,
      'shipment-table',
      {
        dataSourceKey: 'main',
        collectionName: 'shipments',
        associationName: 'transport_runs.shipments',
      },
      openerResource,
    );

    const shipmentResource = shipmentPopupEngine.createResource(SingleRecordResource);
    shipmentResource.save = vi.fn(async () => {
      events.push('save');
      await shipmentResource.refresh();
    });
    const refreshShipment = vi.fn(async () => {
      events.push('refresh shipment');
      dirtyFields.add('declaration_number');
    });
    shipmentResource.refresh = refreshShipment;

    const formModel = {
      resetUserModifiedFields: () => {
        events.push('reset dirty');
        dirtyFields.clear();
      },
    };
    bindShipmentSaveLifecycle(shipmentResource, formModel, shipmentPopupEngine);

    return { dirtyFields, events, refreshShipment, shipmentResource };
  }

  it('clears dirty state only after the final refresh that follows a successful save', async () => {
    const { dirtyFields, events, shipmentResource } = createScenario();

    await shipmentResource.save({ id: 1 });

    expect(dirtyFields).toEqual(new Set(['declaration_number']));
    expect(events).toEqual(['save', 'refresh shipment']);

    await shipmentResource.refresh();

    expect(dirtyFields.size).toBe(0);
    expect(events).toEqual(['save', 'refresh shipment', 'refresh shipment', 'reset dirty', 'refresh opener']);
  });

  it('does not clear an unsaved change when no successful save is pending', async () => {
    const { dirtyFields, events, shipmentResource } = createScenario();
    dirtyFields.add('invoice_number');

    await shipmentResource.refresh();

    expect(dirtyFields).toEqual(new Set(['invoice_number', 'declaration_number']));
    expect(events).toEqual(['refresh shipment']);
  });

  it('synchronizes every repeated successful save before the popup can close', async () => {
    const { dirtyFields, events, shipmentResource } = createScenario();

    await shipmentResource.save({ id: 1 });
    await shipmentResource.refresh();
    await shipmentResource.save({ id: 1 });
    await shipmentResource.refresh();

    expect(dirtyFields.size).toBe(0);
    expect(events.filter((event) => event === 'reset dirty')).toHaveLength(2);
    expect(events.filter((event) => event === 'refresh opener')).toHaveLength(2);
  });

  it('keeps synchronization pending when the final post-save refresh fails', async () => {
    const { dirtyFields, refreshShipment, shipmentResource } = createScenario();
    await shipmentResource.save({ id: 1 });

    refreshShipment.mockRejectedValueOnce(new Error('refresh failed'));

    await expect(shipmentResource.refresh()).rejects.toThrow('refresh failed');
    expect(dirtyFields).toEqual(new Set(['declaration_number']));

    await shipmentResource.refresh();
    expect(dirtyFields.size).toBe(0);
  });
});
