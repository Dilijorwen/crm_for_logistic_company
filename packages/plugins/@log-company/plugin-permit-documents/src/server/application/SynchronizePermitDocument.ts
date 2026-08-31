/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import {
  InvalidRegistryDocumentError,
  validateRegistryDocument,
  type EaeuTechnicalRegulationReference,
  type FsaTechnicalRegulationReference,
  type RegistryDocument,
} from '../domain/permit-document/RegistryDocument';
import { RegistryError } from '../domain/permit-document/RegistryErrors';
import type {
  PermitDocumentIdentity,
  PermitDocumentRepository,
  TechnicalRegulationCandidate,
} from './ports/PermitDocumentRepository';
import type { PermitRegistryGateway } from './ports/PermitRegistryGateway';
import type { SyncClock, SyncLogger } from './ports/PermitDocumentSyncSupport';

export type SynchronizePermitDocumentResult = 'SUCCESS' | 'NOT_FOUND' | 'ERROR' | 'STALE' | 'MISSING';

export class SynchronizePermitDocument {
  private readonly activeSynchronizations = new Map<string, Promise<SynchronizePermitDocumentResult>>();

  constructor(
    private readonly repository: PermitDocumentRepository,
    private readonly registry: PermitRegistryGateway,
    private readonly clock: SyncClock,
    private readonly logger: SyncLogger,
  ) {}

  async execute(documentId: string): Promise<SynchronizePermitDocumentResult> {
    const activeSynchronization = this.activeSynchronizations.get(documentId);
    if (activeSynchronization) {
      return activeSynchronization;
    }
    const synchronization = this.synchronize(documentId).finally(() => {
      if (this.activeSynchronizations.get(documentId) === synchronization) {
        this.activeSynchronizations.delete(documentId);
      }
    });
    this.activeSynchronizations.set(documentId, synchronization);
    return synchronization;
  }

  private async synchronize(documentId: string): Promise<SynchronizePermitDocumentResult> {
    const snapshot = await this.repository.findById(documentId);
    if (!snapshot) {
      return 'MISSING';
    }
    const identity: PermitDocumentIdentity = {
      id: snapshot.id,
      title: snapshot.title,
      documentType: snapshot.documentType,
    };
    const checkedAt = this.clock.now();

    try {
      const registryDocument = snapshot.externalId
        ? await this.registry.getByExternalId(snapshot.documentType, snapshot.externalId)
        : await this.registry.findByTitle(snapshot.documentType, snapshot.title);
      if (!registryDocument) {
        if (snapshot.externalId) {
          await this.repository.markError(identity, checkedAt, 'REGISTRY_RECORD_MISSING');
          return 'ERROR';
        }
        const result = await this.repository.markNotFound(identity, checkedAt);
        return result === 'UPDATED' ? 'NOT_FOUND' : result;
      }

      this.validateIdentity(identity, registryDocument);
      validateRegistryDocument(registryDocument);
      const regulations = await this.resolveTechnicalRegulations(registryDocument);
      const result = await this.repository.applySuccess(identity, registryDocument, regulations, checkedAt);
      if (result === 'UPDATED') {
        this.logger.info('Permit document synchronized.', { documentId });
        return 'SUCCESS';
      }
      return result;
    } catch (error) {
      const errorCode = this.safeErrorCode(error);
      this.logger.warn('Permit document synchronization failed.', { documentId, errorCode });
      const result = await this.repository.markError(identity, checkedAt, errorCode);
      return result === 'UPDATED' ? 'ERROR' : result;
    }
  }

  private validateIdentity(identity: PermitDocumentIdentity, document: RegistryDocument): void {
    if (document.documentType !== identity.documentType || document.documentName.trim() !== identity.title.trim()) {
      throw new InvalidRegistryDocumentError('Registry document identity does not match the requested document.');
    }
  }

  private async resolveTechnicalRegulations(document: RegistryDocument): Promise<TechnicalRegulationCandidate[]> {
    const candidates: TechnicalRegulationCandidate[] = document.technicalRegulations
      .filter((reference): reference is EaeuTechnicalRegulationReference => reference.source === 'EAEU')
      .map((reference) => ({ fsaId: null, docNum: reference.docNum, name: reference.name }));
    const fsaIds = Array.from(
      new Set(
        document.technicalRegulations
          .filter((reference): reference is FsaTechnicalRegulationReference => reference.source === 'FSA')
          .map((reference) => reference.fsaId),
      ),
    );
    if (fsaIds.length === 0) {
      return candidates;
    }

    const existing = await this.repository.findTechnicalRegulationsByFsaIds(fsaIds);
    candidates.push(...existing.map((item) => ({ fsaId: item.fsaId, docNum: item.docNum, name: item.name })));
    const existingIds = new Set(existing.flatMap((item) => (item.fsaId === null ? [] : [item.fsaId])));
    const missingIds = fsaIds.filter((fsaId) => !existingIds.has(fsaId));
    if (missingIds.length === 0) {
      return candidates;
    }

    const resolved = await this.registry.getFsaTechnicalRegulations(missingIds);
    const resolvedIds = new Set(resolved.map((item) => item.fsaId));
    if (missingIds.some((fsaId) => !resolvedIds.has(fsaId))) {
      throw new RegistryError('INVALID_REGISTRY_RESPONSE', 'FSA did not resolve every technical regulation.', false);
    }
    candidates.push(...resolved);
    return candidates;
  }

  private safeErrorCode(error: unknown): string {
    if (error instanceof RegistryError) {
      return error.code;
    }
    if (error instanceof InvalidRegistryDocumentError) {
      return 'INVALID_REGISTRY_RESPONSE';
    }
    this.logger.error('Unexpected permit document synchronization error.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    return 'INTERNAL_SYNC_ERROR';
  }
}
