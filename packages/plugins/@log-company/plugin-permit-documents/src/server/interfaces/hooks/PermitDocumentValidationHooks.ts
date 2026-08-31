/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Transaction } from 'sequelize';
import type { Plugin } from '@nocobase/server';
import type { PermitDocumentRepository } from '../../application/ports/PermitDocumentRepository';
import {
  PermitDocumentValidationError,
  type PermitDocumentValidationErrorCode,
  validatePermitDocument,
} from '../../domain/permit-document/PermitDocumentPolicy';

const COLLECTION_NAME = 'permit_documents';
const NAMESPACE = '@log-company/plugin-permit-documents';
const MANAGED_FIELDS = [
  'valid_from',
  'valid_until',
  'status',
  'product_information',
  'external_id',
  'external_status',
  'sync_status',
  'last_checked_at',
  'last_sync_error',
] as const;

const ERROR_TRANSLATIONS: Record<PermitDocumentValidationErrorCode, string> = {
  INVALID_DOCUMENT_TYPE: 'validation.invalidDocumentType',
  INVALID_STATUS: 'validation.invalidStatus',
  INVALID_SYNC_STATUS: 'validation.invalidSyncStatus',
  INVALID_DATE: 'validation.invalidDate',
  INVALID_DATE_RANGE: 'validation.invalidDateRange',
  MISSING_SUCCESS_FIELD: 'validation.missingSuccessField',
  UNEXPECTED_VALID_UNTIL: 'validation.unexpectedValidUntil',
};

interface NocoBaseModel {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  changed(key: string): boolean;
  previous(key: string): unknown;
}

interface HookOptions {
  context?: unknown;
  transaction?: Transaction;
}

type Translate = (key: string, options: { ns: string }) => string;

function translatorFrom(context: unknown): Translate | null {
  if (context === null || typeof context !== 'object') {
    return null;
  }
  const translate = (context as { t?: unknown }).t;
  return typeof translate === 'function' ? (key, options) => Reflect.apply(translate, context, [key, options]) : null;
}

export class PermitDocumentValidationHooks {
  constructor(
    private readonly plugin: Plugin,
    private readonly repository: PermitDocumentRepository,
  ) {}

  register(): void {
    this.plugin.db.on(`${COLLECTION_NAME}.beforeCreate`, (model: NocoBaseModel, options: HookOptions) => {
      this.normalizeIdentity(model);
      this.resetRegistryFields(model);
      this.validate(model, options);
    });
    this.plugin.db.on(`${COLLECTION_NAME}.beforeUpdate`, (model: NocoBaseModel, options: HookOptions) => {
      this.normalizeIdentity(model);
      if (this.identityChanged(model)) {
        this.resetRegistryFields(model);
      } else {
        this.restoreManagedFields(model);
      }
      this.validate(model, options);
    });
    this.plugin.db.on(`${COLLECTION_NAME}.afterUpdate`, async (model: NocoBaseModel, options: HookOptions) => {
      if (!this.identityChanged(model)) {
        return;
      }
      const documentId = String(model.get('id'));
      await this.repository.clearTechnicalRegulations(documentId, options.transaction);
    });
  }

  private normalizeIdentity(model: NocoBaseModel): void {
    const title = model.get('title');
    if (typeof title === 'string') {
      model.set('title', title.trim());
    }
  }

  private resetRegistryFields(model: NocoBaseModel): void {
    for (const field of MANAGED_FIELDS) {
      model.set(field, field === 'sync_status' ? 'PENDING' : null);
    }
  }

  private restoreManagedFields(model: NocoBaseModel): void {
    for (const field of MANAGED_FIELDS) {
      if (model.changed(field)) {
        model.set(field, model.previous(field));
      }
    }
  }

  private identityChanged(model: NocoBaseModel): boolean {
    return model.changed('title') || model.changed('document_type');
  }

  private validate(model: NocoBaseModel, options: HookOptions): void {
    try {
      validatePermitDocument({
        documentType: model.get('document_type'),
        status: model.get('status'),
        syncStatus: model.get('sync_status'),
        validFrom: model.get('valid_from'),
        validUntil: model.get('valid_until'),
        productInformation: model.get('product_information'),
      });
    } catch (error) {
      if (!(error instanceof PermitDocumentValidationError)) {
        throw error;
      }
      const translationKey = ERROR_TRANSLATIONS[error.code];
      const message = translatorFrom(options.context)?.(translationKey, { ns: NAMESPACE }) ?? translationKey;
      throw Object.assign(new Error(message), { status: 422, statusCode: 422, code: error.code });
    }
  }
}
