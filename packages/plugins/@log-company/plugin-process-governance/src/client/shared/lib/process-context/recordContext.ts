/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

type ProcessResourceKey = string | number;

export type ProcessModelContext = {
  collection?: unknown;
  record?: Record<string, unknown> | null;
  filterByTk?: unknown;
  params?: Record<string, unknown>;
  model?: unknown;
};

export type ProcessTarget =
  | { status: 'ready'; key: ProcessResourceKey; source: string }
  | { status: 'new' | 'missing' | 'loading'; key?: undefined; source?: string };

export function isEmptyResourceKey(value: unknown): value is null | undefined | '' {
  return value === undefined || value === null || value === '';
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function callMethod(target: unknown, methodName: string, ...args: unknown[]): unknown {
  const method = asRecord(target)[methodName];
  if (typeof method !== 'function') {
    return undefined;
  }
  try {
    return method.apply(target, args);
  } catch (error) {
    console.debug(`[process-context] Optional NocoBase method ${methodName} is unavailable`, error);
    return undefined;
  }
}

export function getCollectionName(collection: unknown) {
  if (!collection) {
    return undefined;
  }
  if (typeof collection === 'string') {
    return collection;
  }
  const metadata = asRecord(collection);
  return metadata.name || metadata.collectionName || asRecord(metadata.options).name;
}

export function isRecordCollection(
  collectionName: string,
  collection: unknown,
  record?: Record<string, unknown> | null,
) {
  return (getCollectionName(collection) || record?.__collectionName) === collectionName;
}

export function normalizeFilterByTk(value: unknown): ProcessResourceKey | undefined {
  if (isEmptyResourceKey(value)) {
    return undefined;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(asRecord(value)).filter(([, item]) => !isEmptyResourceKey(item));
    if (!entries.length) {
      return undefined;
    }
    const searchParams = new URLSearchParams();
    entries
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([key, item]) => searchParams.append(key, String(item)));
    return searchParams.toString() || undefined;
  }
  return String(value);
}

function getFallbackTargetKey(collection: unknown) {
  const filterTargetKey = callMethod(collection, 'getFilterTargetKey');
  if (filterTargetKey) {
    return filterTargetKey;
  }
  const primaryKey = callMethod(collection, 'getPrimaryKey');
  if (primaryKey) {
    return primaryKey;
  }

  const metadata = asRecord(collection);
  return metadata.filterTargetKey || asRecord(metadata.options).filterTargetKey || metadata.targetKey || 'id';
}

export function getKeyFromRecord(
  collectionManager: unknown,
  collectionName: string,
  collection: unknown,
  record: Record<string, unknown> | null | undefined,
) {
  if (!record) {
    return undefined;
  }

  const processKey = callMethod(collectionManager, 'getFilterByTK', collectionName, record);
  const normalizedProcessKey = normalizeFilterByTk(processKey);
  if (!isEmptyResourceKey(normalizedProcessKey)) {
    return normalizedProcessKey;
  }

  if (collection) {
    const collectionKey = callMethod(collectionManager, 'getFilterByTK', collection, record);
    const normalizedCollectionKey = normalizeFilterByTk(collectionKey);
    if (!isEmptyResourceKey(normalizedCollectionKey)) {
      return normalizedCollectionKey;
    }
  }

  const targetKey = getFallbackTargetKey(collection);
  if (Array.isArray(targetKey)) {
    return normalizeFilterByTk(
      targetKey.reduce<Record<string, unknown>>((memo, key) => {
        memo[String(key)] = record[String(key)];
        return memo;
      }, {}),
    );
  }

  return normalizeFilterByTk(record[String(targetKey)] ?? record.id);
}

export function getCollectionRecordData(record: unknown) {
  if (!record) {
    return undefined;
  }
  const recordData = asRecord(record);
  return recordData.data && typeof recordData.data === 'object' ? asRecord(recordData.data) : recordData;
}

export function getRecordCollection(collectionManager: unknown, collectionName: string, fallbackCollection?: unknown) {
  return callMethod(collectionManager, 'getCollection', collectionName) || fallbackCollection;
}

export function isUpdateFormBlock(formBlockContext: unknown, dataBlockProps: unknown) {
  const formBlock = asRecord(formBlockContext);
  const dataBlock = asRecord(dataBlockProps);
  return formBlock.type === 'update' || formBlock.action === 'get' || dataBlock.action === 'get';
}

export function isCreateFormBlock(formBlockContext: unknown) {
  return asRecord(formBlockContext).type === 'create';
}
