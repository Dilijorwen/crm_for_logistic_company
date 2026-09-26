/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { EditFormModel, type ResourceSettingsInitParams } from '@nocobase/client';
import {
  type FlowEngine,
  type FlowModelContext,
  MultiRecordResource,
  SingleRecordResource,
} from '@nocobase/flow-engine';
import { LOGISTICS_COLLECTIONS } from '../../shared/logistics';

interface DirtyFormModel {
  resetUserModifiedFields?: () => void;
}

interface ShipmentConsumerRefreshResult {
  refreshed: number;
  errors: unknown[];
}

interface CollectionBlockLike {
  context: {
    resource?: unknown;
  };
  getResourceSettingsInitParams: () => ResourceSettingsInitParams;
}

function isCollectionBlockLike(model: unknown): model is CollectionBlockLike {
  if (model === null || typeof model !== 'object') {
    return false;
  }
  const candidate = model as Partial<CollectionBlockLike>;
  return typeof candidate.getResourceSettingsInitParams === 'function' && candidate.context !== undefined;
}

function isShipmentConsumer(model: CollectionBlockLike): boolean {
  const settings = model.getResourceSettingsInitParams();
  return (
    settings?.collectionName === LOGISTICS_COLLECTIONS.runs ||
    settings?.associationName === `${LOGISTICS_COLLECTIONS.runs}.${LOGISTICS_COLLECTIONS.shipments}`
  );
}

export async function refreshShipmentConsumers(sourceEngine: FlowEngine): Promise<ShipmentConsumerRefreshResult> {
  const resources = new Set<SingleRecordResource | MultiRecordResource>();
  const visitedEngines = new Set<FlowEngine>();
  let engine = sourceEngine.previousEngine;

  while (engine && !visitedEngines.has(engine)) {
    visitedEngines.add(engine);
    engine.forEachModel((model) => {
      if (!isCollectionBlockLike(model) || !isShipmentConsumer(model)) {
        return;
      }
      const resource = model.context.resource;
      if (resource instanceof SingleRecordResource || resource instanceof MultiRecordResource) {
        resources.add(resource);
      }
    });
    engine = engine.previousEngine;
  }

  const results = await Promise.allSettled(Array.from(resources, (resource) => resource.refresh()));
  return {
    refreshed: results.filter((result) => result.status === 'fulfilled').length,
    errors: results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => result.reason),
  };
}

export async function synchronizeSavedShipment(
  formModel: DirtyFormModel,
  sourceEngine: FlowEngine,
): Promise<ShipmentConsumerRefreshResult> {
  formModel.resetUserModifiedFields?.();
  return refreshShipmentConsumers(sourceEngine);
}

export function bindShipmentSaveLifecycle(
  resource: SingleRecordResource,
  formModel: DirtyFormModel,
  sourceEngine: FlowEngine,
): void {
  const save = resource.save.bind(resource);
  const refresh = resource.refresh.bind(resource);
  let synchronizationPending = false;

  resource.save = async (data, options): Promise<void> => {
    await save(data, options);
    synchronizationPending = true;
  };

  resource.refresh = async (): Promise<void> => {
    const shouldSynchronize = synchronizationPending;
    if (shouldSynchronize) {
      synchronizationPending = false;
    }

    try {
      await refresh();
    } catch (error) {
      if (shouldSynchronize) {
        synchronizationPending = true;
      }
      throw error;
    }

    if (!shouldSynchronize) {
      return;
    }

    const refreshResult = await synchronizeSavedShipment(formModel, sourceEngine);
    if (refreshResult.errors.length > 0) {
      console.warn('Не удалось обновить связанные блоки рейса после сохранения поставки.', refreshResult.errors);
    }
  };
}

export class ShipmentSynchronizedEditFormModel extends EditFormModel {
  createResource(
    context: FlowModelContext,
    params: ResourceSettingsInitParams,
  ): SingleRecordResource | MultiRecordResource {
    const resource = super.createResource(context, params);
    if (params.collectionName !== LOGISTICS_COLLECTIONS.shipments || !(resource instanceof SingleRecordResource)) {
      return resource;
    }

    bindShipmentSaveLifecycle(resource, this as unknown as DirtyFormModel, this.flowEngine);

    return resource;
  }
}
