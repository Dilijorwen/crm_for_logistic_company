/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export interface CurrentCollection {
  name: string;
  title: string;
  dataSourceKey: string;
}

const MAX_MODEL_ANCESTORS = 24;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function callMethod(target: unknown, methodName: string, ...args: unknown[]): unknown {
  const method = asRecord(target)[methodName];
  return typeof method === 'function' ? method.apply(target, args) : undefined;
}

function resolveCollectionValue(value: unknown): CurrentCollection | null {
  if (typeof value === 'string' && value) {
    return {
      name: value,
      title: value,
      dataSourceKey: 'main',
    };
  }
  const collection = asRecord(value);
  const options = asRecord(collection.options);
  const dataSource = asRecord(collection.dataSource);
  const name = collection.name ?? collection.collectionName ?? options.name;
  if (typeof name !== 'string' || !name) {
    return null;
  }
  const dataSourceKey = collection.dataSourceKey ?? dataSource.key ?? dataSource.name ?? 'main';
  return {
    name,
    title: String(collection.title ?? options.title ?? name),
    dataSourceKey: String(dataSourceKey),
  };
}

function modelCollectionCandidates(model: Record<string, unknown>): unknown[] {
  const context = asRecord(model.context);
  const stepParams = asRecord(model.stepParams);
  const openView = asRecord(asRecord(stepParams.popupSettings).openView);
  const resourceInit = asRecord(asRecord(stepParams.resourceSettings).init);
  const props = asRecord(model.props);

  return [
    context.collection,
    openView.collectionName
      ? {
          collectionName: openView.collectionName,
          dataSourceKey: openView.dataSourceKey,
        }
      : undefined,
    resourceInit.collectionName
      ? {
          collectionName: resourceInit.collectionName,
          dataSourceKey: resourceInit.dataSourceKey,
        }
      : undefined,
    props.collection,
    context.collectionName
      ? {
          collectionName: context.collectionName,
          dataSourceKey: context.dataSourceKey,
        }
      : undefined,
  ];
}

export function resolveCurrentCollection(value: unknown, model?: unknown): CurrentCollection | null {
  const directCollection = resolveCollectionValue(value);
  if (directCollection) {
    return directCollection;
  }

  let cursor = model;
  const visited = new Set<unknown>();
  for (let depth = 0; cursor && depth < MAX_MODEL_ANCESTORS && !visited.has(cursor); depth += 1) {
    visited.add(cursor);
    const cursorRecord = asRecord(cursor);
    for (const candidate of modelCollectionCandidates(cursorRecord)) {
      const collection = resolveCollectionValue(candidate);
      if (collection) {
        return collection;
      }
    }
    cursor =
      cursorRecord.parent ||
      (cursorRecord.parentId
        ? callMethod(cursorRecord.flowEngine, 'getModel', cursorRecord.parentId, true)
        : undefined);
  }

  return null;
}
