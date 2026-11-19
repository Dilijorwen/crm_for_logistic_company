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
import { getInnermostRouteFilterByTk, getPathRouteFilterByTkValues } from './getInnermostRouteFilterByTk';
import { getFlowModelPopupCollectionMode } from './getFlowModelPopupCollectionMode';
import {
  isEmptyResourceKey,
  isRecordCollection,
  normalizeFilterByTk,
  getKeyFromRecord,
  getCollectionRecordData,
  getRecordCollection,
  isUpdateFormBlock,
  isCreateFormBlock,
} from './recordContext';

import type { ProcessModelContext, ProcessTarget } from './recordContext';

const PROCESS_COLLECTION = 'shipments';
type ProcessResourceKey = string | number;

type ProcessFlowContext = {
  view?: {
    inputArgs?: {
      collectionName?: string;
      filterByTk?: unknown;
    };
  };
};

function isShipmentCollection(collection: unknown, record?: Record<string, unknown> | null) {
  return isRecordCollection(PROCESS_COLLECTION, collection, record);
}

export function useShipmentTarget(
  modelContext?: ProcessModelContext,
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
  const processCollection = getRecordCollection(collectionManager, PROCESS_COLLECTION, collection);
  const formBlockCollection = formBlockContext?.collectionName || dataBlockProps?.collection || collection;
  const isProcessFormBlock = isShipmentCollection(formBlockCollection);
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
      const key = getKeyFromRecord(collectionManager, PROCESS_COLLECTION, processCollection, candidate.record);
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
    if (!isShipmentCollection(candidate.collection, candidate.record)) {
      continue;
    }
    const key = getKeyFromRecord(collectionManager, PROCESS_COLLECTION, candidate.collection, candidate.record);
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
    candidates.some((candidate) => isShipmentCollection(candidate.collection, candidate.record));
  const isNewProcess =
    formBlockIsCreate ||
    candidates.some((candidate) => candidate.isNew && isShipmentCollection(candidate.collection, candidate.record));

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
