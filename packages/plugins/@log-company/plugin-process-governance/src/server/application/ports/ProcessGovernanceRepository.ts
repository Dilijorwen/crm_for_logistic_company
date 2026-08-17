/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { ProcessHistoryEntry } from '../../domain/history/ProcessHistory';
import type { EntityId } from '../../domain/shared/Identifiers';

export type GovernanceTransaction = unknown;

export interface ProcessCoreData {
  id: string;
  title: string;
  status: unknown;
  processNumber: unknown;
  carNumber: unknown;
  chineseClientId: EntityId | null;
}

export interface TrackedProcessField {
  name: string;
  label: string;
  storageKey: string;
  kind: 'scalar' | 'belongsTo';
  targetCollection?: string;
  targetKey?: string;
  enumOptions?: Array<{ value: unknown; label: string }>;
}

export type ProcessValuesSnapshot = Record<string, unknown>;

export interface ProcessGovernanceRepository {
  getProcessStatusValues(): string[];
  lockParentGraph(transaction?: GovernanceTransaction): Promise<void>;
  getParentIds(processId: EntityId, transaction?: GovernanceTransaction): Promise<EntityId[]>;
  parentSelectionCreatesCycle(
    processId: EntityId,
    parentIds: EntityId[],
    transaction?: GovernanceTransaction,
  ): Promise<boolean>;
  nextProcessNumber(transaction?: GovernanceTransaction): Promise<number>;
  rebalanceProcessNumbers(transaction?: GovernanceTransaction): Promise<void>;
  findChineseClientName(clientId: EntityId, transaction?: GovernanceTransaction): Promise<string>;
  refreshTitlesForChineseClient(
    clientId: EntityId,
    clientName: string,
    transaction?: GovernanceTransaction,
  ): Promise<void>;
  findProcess(processId: EntityId, transaction?: GovernanceTransaction): Promise<ProcessCoreData | null>;
  getTrackedFields(): TrackedProcessField[];
  findProcessValues(
    processId: EntityId,
    fields: TrackedProcessField[],
    transaction?: GovernanceTransaction,
  ): Promise<ProcessValuesSnapshot | null>;
  getRecordLabel(
    collectionName: string,
    id: EntityId,
    targetKey: string,
    transaction?: GovernanceTransaction,
  ): Promise<string>;
  historyCollectionExists(): boolean;
  createHistory(entry: ProcessHistoryEntry, transaction?: GovernanceTransaction, context?: unknown): Promise<void>;
}

export interface GovernanceLogger {
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error: unknown, metadata?: Record<string, unknown>): void;
}
