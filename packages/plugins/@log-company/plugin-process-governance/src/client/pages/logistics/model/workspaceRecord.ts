/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export interface LogisticsWorkspaceRecordIds {
  runId: string;
  shipmentId: string | null;
}

interface RecordWithGetter {
  id?: unknown;
  get?: (name: string) => unknown;
}

function workspaceRowId(record: unknown): string | null {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    return null;
  }
  const value = record as RecordWithGetter;
  const id = value.id ?? value.get?.('id');
  return typeof id === 'string' && id ? id : null;
}

/** Parses the stable `runId:shipmentId` key produced by the SQL read model. */
export function logisticsWorkspaceRecordIds(record: unknown): LogisticsWorkspaceRecordIds | null {
  const id = workspaceRowId(record);
  if (!id) {
    return null;
  }
  const [runId, shipmentId, ...unexpected] = id.split(':');
  if (!/^[1-9]\d*$/.test(runId || '') || !/^\d+$/.test(shipmentId || '') || unexpected.length) {
    return null;
  }
  return { runId, shipmentId: shipmentId === '0' ? null : shipmentId };
}

export function isLogisticsWorkspaceContext(context: unknown): boolean {
  if (!context || typeof context !== 'object') return false;
  const value = context as { collection?: { name?: unknown }; blockModel?: { collection?: { name?: unknown } } };
  return (value.collection ?? value.blockModel?.collection)?.name === 'logistics_work_items';
}
