/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type {
  PermitDocumentStatus,
  PermitDocumentSyncStatus,
  PermitDocumentType,
} from '../../domain/permit-document/PermitDocumentPolicy';
import type { RegistryDocument, RegistryDocumentStatus } from '../../domain/permit-document/RegistryDocument';

export type TransactionContext = unknown;

export interface PermitDocumentSnapshot {
  id: string;
  title: string;
  documentType: PermitDocumentType;
  externalId: string | null;
  syncStatus: PermitDocumentSyncStatus;
  status: PermitDocumentStatus | null;
  lastCheckedAt: Date | null;
}

export interface PermitDocumentIdentity {
  id: string;
  title: string;
  documentType: PermitDocumentType;
}

export interface TechnicalRegulationRecord {
  id: string;
  fsaId: number | null;
  docNum: string;
  name: string | null;
}

export interface TechnicalRegulationCandidate {
  fsaId: number | null;
  docNum: string;
  name: string | null;
}

export type ApplySyncResult = 'UPDATED' | 'STALE' | 'MISSING';

export interface PermitDocumentRepository {
  findById(documentId: string): Promise<PermitDocumentSnapshot | null>;
  findTechnicalRegulationsByFsaIds(fsaIds: readonly number[]): Promise<TechnicalRegulationRecord[]>;
  markPending(documentId: string): Promise<boolean>;
  markNotFound(identity: PermitDocumentIdentity, checkedAt: Date): Promise<ApplySyncResult>;
  markError(identity: PermitDocumentIdentity, checkedAt: Date, errorCode: string): Promise<ApplySyncResult>;
  applySuccess(
    identity: PermitDocumentIdentity,
    document: RegistryDocument,
    name: string,
    regulations: readonly TechnicalRegulationCandidate[],
    checkedAt: Date,
  ): Promise<ApplySyncResult>;
  applyStatusCheck(
    identity: PermitDocumentIdentity,
    expectedExternalId: string,
    document: RegistryDocumentStatus,
    checkedAt: Date,
  ): Promise<ApplySyncResult>;
  listPendingIds(limit: number): Promise<string[]>;
  listDailyFullSyncDueIds(checkedBefore: Date, limit: number): Promise<string[]>;
  listDailyStatusCheckDueIds(checkedBefore: Date, limit: number): Promise<string[]>;
  clearTechnicalRegulations(documentId: string, transaction?: TransactionContext): Promise<void>;
}
