/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import {
  WORKSPACE_RUN_VIEW_UID,
  WORKSPACE_SHIPMENT_VIEW_UID,
  WORKSPACE_CREATE_SHIPMENT_VIEW_UID,
} from '../../../../shared/workspace';
import { workspaceAnchors, type WorkspaceViewHost } from '../../../shared/lib';

/** Let FlowRoute own view visibility, cleanup, back navigation and the preserved opener. */
export async function openWorkspaceView(model: WorkspaceViewHost, uid: string, input: Record<string, unknown> = {}) {
  const navigation = model.context.view?.navigation;
  if (!navigation) throw new Error('Не удалось определить навигацию рабочего списка.');
  const popup = await model.flowEngine.loadModel({ uid });
  if (!popup) throw new Error('Не удалось загрузить карточку рейса или поставки.');
  const runId = workspaceAnchors(input).runId;
  const params = {
    viewUid: uid,
    filterByTk: typeof input.filterByTk === 'string' ? input.filterByTk : undefined,
    tabUid:
      typeof input.tabUid === 'string'
        ? input.tabUid
        : uid === WORKSPACE_CREATE_SHIPMENT_VIEW_UID
          ? 'lcwsnewshiptab'
          : undefined,
    // sourceId is the native route parameter. The popup resolves this anchor
    // before opening a source form, and clears its association context.
    sourceId: uid === WORKSPACE_RUN_VIEW_UID ? undefined : runId || undefined,
  };
  if (uid === WORKSPACE_RUN_VIEW_UID && model.context.view.inputArgs?.viewUid === uid) {
    navigation.changeTo(params);
  } else {
    navigation.navigateTo(params);
  }
}

export function openWorkspaceRun(
  model: WorkspaceViewHost,
  runId: string,
  rowId = `${runId}:0`,
  tabUid = 'lcwsruntab',
  additional: Record<string, unknown> = {},
) {
  const select = model.context.selectWorkspaceRun as ((id: string) => void) | undefined;
  if (typeof select === 'function') select(runId);
  return openWorkspaceView(model, WORKSPACE_RUN_VIEW_UID, {
    collectionName: 'logistics_work_items',
    filterByTk: rowId,
    workspaceRunId: runId,
    tabUid,
    ...additional,
  });
}

export function openWorkspaceCreateShipment(model: WorkspaceViewHost, runId: string) {
  return openWorkspaceView(model, WORKSPACE_CREATE_SHIPMENT_VIEW_UID, {
    collectionName: 'shipments',
    filterByTk: null,
    workspaceRunId: runId,
  });
}

export function openWorkspaceShipment(model: WorkspaceViewHost, runId: string, shipmentId: string) {
  return openWorkspaceView(model, WORKSPACE_SHIPMENT_VIEW_UID, {
    collectionName: 'shipments',
    filterByTk: shipmentId,
    workspaceRunId: runId,
    workspaceShipmentId: shipmentId,
    tabUid: 'lcwsshipmentfulltab',
  });
}
