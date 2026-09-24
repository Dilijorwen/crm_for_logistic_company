/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export type FlowModelPopupCollectionMode = 'create' | 'record';

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function callGetModel(flowEngine: unknown, parentId: unknown) {
  const getModel = asRecord(flowEngine).getModel;
  if (typeof getModel !== 'function' || (typeof parentId !== 'string' && typeof parentId !== 'number')) {
    return undefined;
  }
  try {
    return getModel.call(flowEngine, parentId, true);
  } catch {
    return undefined;
  }
}

function getConfiguredCollectionName(model: Record<string, unknown>) {
  const stepParams = asRecord(model.stepParams);
  return (
    asRecord(asRecord(stepParams.popupSettings).openView).collectionName ||
    asRecord(asRecord(stepParams.resourceSettings).init).collectionName ||
    asRecord(model.props).collection ||
    asRecord(model.context).collectionName
  );
}

function getViewCollectionMode(
  model: Record<string, unknown>,
  collectionName: string,
): FlowModelPopupCollectionMode | undefined {
  const inputArgs = asRecord(asRecord(asRecord(model.context).view).inputArgs);
  if (inputArgs.collectionName !== collectionName) {
    return undefined;
  }
  return inputArgs.filterByTk === undefined || inputArgs.filterByTk === null || inputArgs.filterByTk === ''
    ? 'create'
    : 'record';
}

/**
 * Identifies whether a custom block belongs to a record or create popup for a
 * collection. Nested NocoBase child pages do not always copy their view input
 * arguments into custom block contexts, but the action that opened the page is
 * still present in the FlowModel ancestry.
 */
export function getFlowModelPopupCollectionMode(
  model: unknown,
  collectionName: string,
): FlowModelPopupCollectionMode | undefined {
  let cursor = model;
  let recordPopupFound = false;
  const seen = new Set<unknown>();

  for (let depth = 0; cursor && depth < 24 && !seen.has(cursor); depth += 1) {
    seen.add(cursor);
    const cursorRecord = asRecord(cursor);
    const viewCollectionMode = getViewCollectionMode(cursorRecord, collectionName);
    if (viewCollectionMode) {
      return viewCollectionMode;
    }
    if (getConfiguredCollectionName(cursorRecord) === collectionName) {
      if (cursorRecord.use === 'CreateFormModel' || cursorRecord.use === 'AddNewActionModel') {
        return 'create';
      }
      recordPopupFound = true;
    }

    cursor = cursorRecord.parent || callGetModel(cursorRecord.flowEngine, cursorRecord.parentId);
  }

  return recordPopupFound ? 'record' : undefined;
}
