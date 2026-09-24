/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { LogisticsEntityKind, LogisticsHistoryEntry } from '../../../domain/logistics/LogisticsHistory';
import type { ShipmentDisplayNameParts } from '../../../domain/logistics/ShipmentDisplayName';
import type { EntityId } from '../../../domain/shared/Identifiers';

export type LogisticsTransaction = unknown;
export type LogisticsValuesSnapshot = Record<string, unknown>;

export interface TrackedLogisticsField {
  name: string;
  label: string;
  storageKey: string;
  kind: 'scalar' | 'belongsTo';
  targetCollection?: string;
  targetKey?: string;
  enumOptions?: Array<{ value: unknown; label: string }>;
}

export interface LogisticsRepository {
  nextNumber(entityKind: LogisticsEntityKind, transaction?: LogisticsTransaction): Promise<number>;
  findOrCreateVehicle(registrationNumber: string, transaction?: LogisticsTransaction): Promise<EntityId>;
  lockRunParentGraph(transaction?: LogisticsTransaction): Promise<void>;
  getRunParentIds(runId: EntityId, transaction?: LogisticsTransaction): Promise<EntityId[]>;
  runParentSelectionCreatesCycle(
    runId: EntityId,
    parentIds: EntityId[],
    transaction?: LogisticsTransaction,
  ): Promise<boolean>;
  countShipmentRunLinks(shipmentId: EntityId, transaction?: LogisticsTransaction): Promise<number>;
  isContractLinkedToCompany(
    contractId: EntityId,
    companyId: EntityId,
    transaction?: LogisticsTransaction,
  ): Promise<boolean>;
  getRunRegistrationNumbers(runIds: EntityId[], transaction?: LogisticsTransaction): Promise<Map<string, string>>;
  getShipmentDisplayNameParts(
    shipmentId: EntityId,
    transaction?: LogisticsTransaction,
  ): Promise<ShipmentDisplayNameParts | null>;
  updateShipmentDisplayName(
    shipmentId: EntityId,
    displayName: string,
    transaction?: LogisticsTransaction,
  ): Promise<void>;
  getShipmentIdsByClientId(clientId: EntityId, transaction?: LogisticsTransaction): Promise<EntityId[]>;
  getTrackedFields(entityKind: LogisticsEntityKind): TrackedLogisticsField[];
  findEntityValues(
    entityKind: LogisticsEntityKind,
    entityId: EntityId,
    fields: TrackedLogisticsField[],
    transaction?: LogisticsTransaction,
  ): Promise<LogisticsValuesSnapshot | null>;
  getRecordLabel(
    collectionName: string,
    id: EntityId,
    targetKey: string,
    transaction?: LogisticsTransaction,
  ): Promise<string>;
  getEntityLabel(
    entityKind: LogisticsEntityKind,
    entityId: EntityId,
    transaction?: LogisticsTransaction,
  ): Promise<string>;
  historyCollectionExists(entityKind: LogisticsEntityKind): boolean;
  createHistory(entry: LogisticsHistoryEntry, transaction?: LogisticsTransaction, context?: unknown): Promise<void>;
}

export interface LogisticsLogger {
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error: unknown, metadata?: Record<string, unknown>): void;
}
