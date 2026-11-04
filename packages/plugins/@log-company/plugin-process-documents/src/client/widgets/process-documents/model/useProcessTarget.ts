/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import {
  useCollection,
  useCollectionManager,
  useCollectionRecord,
  useCurrentPopupRecord,
  useDataBlockProps,
  useFormBlockContext,
  useRecord,
} from '@nocobase/client';
import { useFlowContext } from '@nocobase/flow-engine';
import {
  getFlowModelPopupCollectionMode,
  getInnermostRouteFilterByTk,
  getPathRouteFilterByTkValues,
} from '@log-company/plugin-process-governance/client';

const PROCESS_COLLECTION = 'shipments';
type ProcessResourceKey = string | number;

export type ProcessDocumentsModelContext = {
  collection?: unknown;
  record?: Record<string, unknown> | null;
  filterByTk?: unknown;
  params?: Record<string, unknown>;
  model?: unknown;
};

type ProcessFlowContext = {
  view?: {
    inputArgs?: {
      collectionName?: string;
      filterByTk?: unknown;
    };
  };
};

export type ProcessTarget =
  | { status: 'ready'; key: ProcessResourceKey; source: string }
  | { status: 'new' | 'missing' | 'loading'; key?: undefined; source?: string };

export function isEmptyResourceKey(value: unknown): value is null | undefined | '' {
  return value === undefined || value === null || value === '';
}

function asRecord(value: unknown): Record<string, unknown> {
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
    console.debug(`[process-documents] Optional NocoBase method ${methodName} is unavailable`, error);
    return undefined;
  }
}

function getCollectionName(collection: unknown) {
  if (!collection) {
    return undefined;
  }
  if (typeof collection === 'string') {
    return collection;
  }
  const metadata = asRecord(collection);
  return metadata.name || metadata.collectionName || asRecord(metadata.options).name;
}

function isProcessCollection(collection: unknown, record?: Record<string, unknown> | null) {
  return (getCollectionName(collection) || record?.__collectionName) === PROCESS_COLLECTION;
}

function normalizeFilterByTk(value: unknown): ProcessResourceKey | undefined {
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

function getKeyFromRecord(
  collectionManager: unknown,
  collection: unknown,
  record: Record<string, unknown> | null | undefined,
) {
  if (!record) {
    return undefined;
  }

  const processKey = callMethod(collectionManager, 'getFilterByTK', PROCESS_COLLECTION, record);
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

function getCollectionRecordData(record: unknown) {
  if (!record) {
    return undefined;
  }
  const recordData = asRecord(record);
  return recordData.data && typeof recordData.data === 'object' ? asRecord(recordData.data) : recordData;
}

function getProcessCollection(collectionManager: unknown, fallbackCollection?: unknown) {
  return callMethod(collectionManager, 'getCollection', PROCESS_COLLECTION) || fallbackCollection;
}

function isUpdateFormBlock(formBlockContext: unknown, dataBlockProps: unknown) {
  const formBlock = asRecord(formBlockContext);
  const dataBlock = asRecord(dataBlockProps);
  return formBlock.type === 'update' || formBlock.action === 'get' || dataBlock.action === 'get';
}

function isCreateFormBlock(formBlockContext: unknown) {
  return asRecord(formBlockContext).type === 'create';
}

export function useProcessTarget(
  modelContext?: ProcessDocumentsModelContext,
  explicitProcessId?: ProcessResourceKey | null,
): ProcessTarget {
  const collectionManager = useCollectionManager();
  const collection = useCollection();
  const collectionRecord = useCollectionRecord<Record<string, unknown>>();
  const dataBlockProps = useDataBlockProps();
  const formBlockContext = useFormBlockContext();
  const popupRecord = useCurrentPopupRecord();
  const recordContext = useRecord<Record<string, unknown>>();
  const flowContext = useFlowContext<ProcessFlowContext>();
  const viewInputArgs = flowContext?.view?.inputArgs;
  const isProcessView = viewInputArgs?.collectionName === PROCESS_COLLECTION;
  const viewProcessKey = normalizeFilterByTk(viewInputArgs?.filterByTk);
  const processCollection = getProcessCollection(collectionManager, collection);
  const formBlockCollection = formBlockContext?.collectionName || dataBlockProps?.collection || collection;
  const isProcessFormBlock = isProcessCollection(formBlockCollection);
  const formBlockIsCreate = isProcessFormBlock && isCreateFormBlock(formBlockContext);
  const formBlockIsUpdate = isProcessFormBlock && isUpdateFormBlock(formBlockContext, dataBlockProps);
  const popupCollectionMode = getFlowModelPopupCollectionMode(modelContext?.model, PROCESS_COLLECTION);
  const blockIsInProcessCreatePopup = popupCollectionMode === 'create';

  if (formBlockIsCreate || blockIsInProcessCreatePopup || (isProcessView && isEmptyResourceKey(viewProcessKey))) {
    return {
      status: 'new',
      source: formBlockIsCreate ? 'form-create' : isProcessView ? 'view-create' : 'create-popup',
    };
  }

  if (formBlockIsUpdate) {
    const formCandidates = [
      { source: 'form-record', record: getCollectionRecordData(formBlockContext?.formRecord) },
      { source: 'form-current-values', record: formBlockContext?.form?.values },
      { source: 'form-initial-values', record: formBlockContext?.form?.initialValues },
      { source: 'form-service-data', record: formBlockContext?.service?.data?.data },
    ];

    for (const candidate of formCandidates) {
      if (!candidate.record) {
        continue;
      }
      const key = getKeyFromRecord(collectionManager, processCollection, candidate.record);
      if (!isEmptyResourceKey(key)) {
        return { status: 'ready', key, source: candidate.source };
      }
    }
  }

  const candidates = [
    { source: 'edit-popup', collection: popupRecord?.collection, record: popupRecord?.value },
    { source: 'record-context', collection: collection || modelContext?.collection, record: recordContext },
    {
      source: 'collection-record',
      collection: collection || dataBlockProps?.collection,
      record: collectionRecord?.data,
      isNew: collectionRecord?.isNew,
    },
    { source: 'model-context', collection: modelContext?.collection, record: modelContext?.record },
  ];

  for (const candidate of candidates) {
    if (!isProcessCollection(candidate.collection, candidate.record)) {
      continue;
    }
    const key = getKeyFromRecord(collectionManager, candidate.collection, candidate.record);
    if (!isEmptyResourceKey(key)) {
      return { status: 'ready', key, source: candidate.source };
    }
  }

  if (!isEmptyResourceKey(explicitProcessId)) {
    return { status: 'ready', key: explicitProcessId, source: 'explicit-prop' };
  }

  if (isProcessView && !isEmptyResourceKey(viewProcessKey)) {
    return { status: 'ready', key: viewProcessKey, source: 'flow-view' };
  }

  const nestedPopupRouteKeys = getPathRouteFilterByTkValues();
  if (nestedPopupRouteKeys.length > 1) {
    return {
      status: 'ready',
      key: nestedPopupRouteKeys[nestedPopupRouteKeys.length - 1],
      source: 'nested-popup-route',
    };
  }

  const hasProcessContext =
    isProcessFormBlock ||
    popupCollectionMode === 'record' ||
    candidates.some((candidate) => isProcessCollection(candidate.collection, candidate.record));
  const isNewProcess =
    formBlockIsCreate ||
    candidates.some((candidate) => candidate.isNew && isProcessCollection(candidate.collection, candidate.record));

  if (isNewProcess) {
    return { status: 'new', source: 'form-record' };
  }

  const routeKey = normalizeFilterByTk(getInnermostRouteFilterByTk());
  if (popupCollectionMode === 'record' && !isEmptyResourceKey(routeKey)) {
    return { status: 'ready', key: routeKey, source: 'popup-route' };
  }

  const fallbackKey = normalizeFilterByTk(
    dataBlockProps?.filterByTk ??
      dataBlockProps?.params?.filterByTk ??
      formBlockContext?.params?.filterByTk ??
      modelContext?.filterByTk ??
      modelContext?.params?.filterByTk,
  );
  if (hasProcessContext && !isEmptyResourceKey(fallbackKey)) {
    return { status: 'ready', key: fallbackKey, source: 'filterByTk' };
  }

  if (hasProcessContext && !isEmptyResourceKey(routeKey)) {
    return { status: 'ready', key: routeKey, source: 'route' };
  }

  if (formBlockIsUpdate || (dataBlockProps?.action === 'get' && hasProcessContext)) {
    return { status: 'loading', source: 'form-record' };
  }

  return { status: 'missing' };
}
