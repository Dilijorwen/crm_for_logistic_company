/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { AssociateActionModel, TableBlockModel } from '@nocobase/client';
import { createBlockScopedEngine } from '@nocobase/flow-engine';
import type { WorkspaceViewHost } from '../../../shared/lib';

/** Reuse the saved native selector in a fresh source context, without opening a run card. */
export async function openWorkspaceAssociation(host: WorkspaceViewHost, runId: string): Promise<void> {
  if (!/^[1-9]\d*$/.test(runId)) throw new Error('Не удалось определить рейс для привязки.');
  const definition = await host.flowEngine.modelRepository?.findOne({ uid: 'lcwsrsassociate' });
  if (!definition?.uid) throw new Error('Не удалось загрузить настройки выбора поставок.');
  const engine = createBlockScopedEngine(host.flowEngine);
  const table = engine.createModel({
    use: 'TableBlockModel',
    stepParams: {
      resourceSettings: {
        init: {
          dataSourceKey: 'main',
          collectionName: 'shipments',
          associationName: 'transport_runs.shipments',
          sourceId: runId,
        },
      },
    },
  }) as unknown as TableBlockModel;
  table.resource.setSourceId(runId);
  try {
    // Selector grids must be created inside the selector's view context. Eagerly
    // creating them here would bind TableSelectModel to the opener's view.
    const action = table.addSubModel('actions', {
      ...definition,
      use: 'LogisticsWorkspaceAssociateActionModel',
      subModels: undefined,
      parentId: table.uid,
      subKey: 'actions',
      subType: 'array',
    }) as unknown as AssociateActionModel;
    await action.dispatchEvent('click', { mode: 'dialog', size: 'large' }, { debounce: false, useCache: false });
  } finally {
    engine.removeModelWithSubModels(table.uid);
    engine.unlinkFromStack();
  }
}
