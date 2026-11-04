/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export interface WorkspaceRecordIds {
  runId: string;
  shipmentId: string | null;
}
export { LOGISTICS_RECORDS_CHANGED, notifyWorkspaceChanged } from './events';
export type { WorkspaceViewHost } from './viewHost';

export function workspaceRecordIds(value: unknown): WorkspaceRecordIds | null {
  if (typeof value !== 'string') return null;
  const match = /^([1-9]\d*):(0|[1-9]\d*)$/.exec(value);
  return match ? { runId: match[1], shipmentId: match[2] === '0' ? null : match[2] } : null;
}

export function recordId(record: unknown): unknown {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return undefined;
  const value = record as { id?: unknown; get?: (name: string) => unknown };
  return value.id ?? value.get?.('id');
}

export function isWorkspaceContext(context: unknown): boolean {
  if (!context || typeof context !== 'object') return false;
  const value = context as { collection?: { name?: unknown }; blockModel?: { collection?: { name?: unknown } } };
  return (value.collection ?? value.blockModel?.collection)?.name === 'logistics_work_items';
}

export function isWorkspaceDeleteContext(context: unknown): boolean {
  if (isWorkspaceContext(context)) return true;
  if (!context || typeof context !== 'object') return false;
  const candidate = context as { blockModel?: { getResourceSettingsInitParams?(): { associationName?: string } } };
  return candidate.blockModel?.getResourceSettingsInitParams?.().associationName === 'transport_runs.shipments';
}

function sourceIdentifier(value: unknown): string | null {
  const id = value && typeof value === 'object' ? recordId(value) : value;
  return (typeof id === 'string' || typeof id === 'number') && /^[1-9]\d*$/.test(String(id)) ? String(id) : null;
}

/** Explicit anchors survive nested popup contexts and source collection changes. */
export function workspaceAnchors(args: Record<string, unknown> = {}): WorkspaceRecordIds {
  const composite = workspaceRecordIds(args.filterByTk);
  return {
    runId:
      sourceIdentifier(args.workspaceRunId) ||
      composite?.runId ||
      (args.collectionName === 'transport_runs' ? sourceIdentifier(args.filterByTk) : null) ||
      '',
    shipmentId:
      sourceIdentifier(args.workspaceShipmentId) ||
      composite?.shipmentId ||
      (args.collectionName === 'shipments' ? sourceIdentifier(args.filterByTk) : null),
  };
}
