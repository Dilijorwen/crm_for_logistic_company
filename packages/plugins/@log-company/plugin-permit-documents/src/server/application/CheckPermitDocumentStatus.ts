/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { InvalidRegistryDocumentError, type RegistryDocumentStatus } from '../domain/permit-document/RegistryDocument';
import { RegistryError } from '../domain/permit-document/RegistryErrors';
import type { PermitDocumentIdentity, PermitDocumentRepository } from './ports/PermitDocumentRepository';
import type { PermitRegistryGateway } from './ports/PermitRegistryGateway';
import type { SyncClock, SyncLogger } from './ports/PermitDocumentSyncSupport';

export type CheckPermitDocumentStatusResult = 'SUCCESS' | 'ERROR' | 'STALE' | 'MISSING';

export class CheckPermitDocumentStatus {
  private readonly activeChecks = new Map<string, Promise<CheckPermitDocumentStatusResult>>();

  constructor(
    private readonly repository: PermitDocumentRepository,
    private readonly registry: PermitRegistryGateway,
    private readonly clock: SyncClock,
    private readonly logger: SyncLogger,
  ) {}

  async execute(documentId: string): Promise<CheckPermitDocumentStatusResult> {
    const activeCheck = this.activeChecks.get(documentId);
    if (activeCheck) {
      return activeCheck;
    }
    const check = this.check(documentId).finally(() => {
      if (this.activeChecks.get(documentId) === check) {
        this.activeChecks.delete(documentId);
      }
    });
    this.activeChecks.set(documentId, check);
    return check;
  }

  private async check(documentId: string): Promise<CheckPermitDocumentStatusResult> {
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

    if (!snapshot.externalId) {
      const result = await this.repository.markError(identity, checkedAt, 'INVALID_REGISTRY_RESPONSE');
      return result === 'UPDATED' ? 'ERROR' : result;
    }

    try {
      const registryStatus = await this.registry.findStatusByTitle(snapshot.documentType, snapshot.title);
      if (!registryStatus) {
        const result = await this.repository.markError(identity, checkedAt, 'REGISTRY_RECORD_MISSING');
        return result === 'UPDATED' ? 'ERROR' : result;
      }
      this.validateIdentity(identity, snapshot.externalId, registryStatus);
      const result = await this.repository.applyStatusCheck(identity, snapshot.externalId, registryStatus, checkedAt);
      if (result === 'UPDATED') {
        this.logger.info('Permit document status checked.', { documentId });
        return 'SUCCESS';
      }
      return result;
    } catch (error) {
      const errorCode = this.safeErrorCode(error);
      this.logger.warn('Permit document status check failed.', { documentId, errorCode });
      const result = await this.repository.markError(identity, checkedAt, errorCode);
      return result === 'UPDATED' ? 'ERROR' : result;
    }
  }

  private validateIdentity(
    identity: PermitDocumentIdentity,
    expectedExternalId: string,
    document: RegistryDocumentStatus,
  ): void {
    if (
      document.externalId !== expectedExternalId ||
      document.documentType !== identity.documentType ||
      document.documentName.trim() !== identity.title.trim()
    ) {
      throw new InvalidRegistryDocumentError('Registry document identity does not match the saved document.');
    }
  }

  private safeErrorCode(error: unknown): string {
    if (error instanceof RegistryError) {
      return error.code;
    }
    if (error instanceof InvalidRegistryDocumentError) {
      return 'INVALID_REGISTRY_RESPONSE';
    }
    this.logger.error('Unexpected permit document status check error.', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    return 'INTERNAL_SYNC_ERROR';
  }
}
