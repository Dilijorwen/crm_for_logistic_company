/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import {
  getCollectionName,
  getKeyFromRecord,
  normalizeFilterByTk,
  type ProcessModelContext,
} from '@log-company/plugin-process-governance/client';

export function documentBlockTarget(
  context?: ProcessModelContext,
  explicitShipmentId?: string | number | null,
  collectionMetadata?: (name: string) => unknown,
) {
  const collection = getCollectionName(context?.collection) ?? context?.record?.__collectionName;
  const collectionName = typeof collection === 'string' ? collection : undefined;
  if (explicitShipmentId != null || !collectionName || collectionName === 'shipments') {
    return { kind: 'shipment' as const, collection: 'shipments', recordId: explicitShipmentId ?? key('shipments') };
  }
  const recordId = key(collectionName);
  if (recordId === undefined) return { kind: 'unsaved' as const, collection: collectionName };
  if (collectionName === 'our_companies') return { kind: 'company' as const, collection: collectionName, recordId };
  if (collectionName === 'transport_runs') return { kind: 'run' as const, collection: collectionName, recordId };
  return { kind: 'attachment' as const, collection: collectionName, recordId };

  function key(name: string) {
    return (
      normalizeFilterByTk(context?.filterByTk) ??
      getKeyFromRecord(undefined, name, collectionMetadata?.(name) ?? context?.collection, context?.record)
    );
  }
}
