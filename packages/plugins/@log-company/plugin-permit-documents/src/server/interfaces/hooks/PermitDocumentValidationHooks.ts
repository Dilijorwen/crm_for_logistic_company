/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Transaction } from 'sequelize';
import type { MultipleRelationRepository } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import type { PermitDocumentRepository } from '../../application/ports/PermitDocumentRepository';
import { buildPermitDocumentName } from '../../domain/permit-document/RegistryDocument';
import {
  permitDocumentCategory,
  permitDocumentPeriod,
  permitDocumentToday,
  PermitDocumentCategoryError,
  validatePermitDocumentCategory,
  voluntaryDocumentStatus,
} from '../../domain/permit-document/PermitDocumentCategoryPolicy';
import type { PermitDocumentCategory } from '../../domain/permit-document/PermitDocumentCategoryPolicy';
import {
  PermitDocumentValidationError,
  type PermitDocumentValidationErrorCode,
  validatePermitDocument,
} from '../../domain/permit-document/PermitDocumentPolicy';

const COLLECTION_NAME = 'permit_documents';
const MANAGED_FIELDS = [
  'name',
  'valid_from',
  'valid_until',
  'status',
  'product_information',
  'external_id',
  'external_status',
  'sync_status',
  'last_checked_at',
  'last_sync_error',
  'manufacturer_name',
  'manufacturer_address',
] as const;

const ERROR_MESSAGES: Record<PermitDocumentValidationErrorCode, string> = {
  INVALID_DOCUMENT_TYPE: 'Выберите тип документа: ДС, СС или СГР.',
  INVALID_STATUS: 'Указан недопустимый статус документа.',
  INVALID_SYNC_STATUS: 'Указан недопустимый статус синхронизации.',
  INVALID_DATE: 'Укажите корректные даты действия документа.',
  INVALID_DATE_RANGE: 'Дата окончания действия не может быть раньше даты начала.',
  MISSING_SUCCESS_FIELD: 'Реестр вернул не все обязательные сведения о документе. Повторите проверку позже.',
  UNEXPECTED_VALID_UNTIL: 'Для СГР дата окончания действия должна быть пустой.',
};

interface NocoBaseModel {
  isNewRecord: boolean;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  changed(key: string): boolean;
  previous(key: string): unknown;
}

interface HookOptions {
  context?: unknown;
  transaction?: Transaction;
  skip?: readonly string[];
  inputValues?: Record<string, unknown>;
  values?: Record<string, unknown>;
  fields?: string[];
}

export class PermitDocumentValidationHooks {
  constructor(
    private readonly plugin: Plugin,
    private readonly repository: PermitDocumentRepository,
  ) {}

  register(): void {
    this.plugin.db.on(`${COLLECTION_NAME}.beforeValidate`, async (model: NocoBaseModel, options: HookOptions) => {
      // Sequelize validates association-only bulk updates on a partial model marked as new.
      const isAssociationValidation = options.skip?.includes('document_type') && options.skip.includes('title');
      if (
        model.get('document_type') == null &&
        !this.identityChanged(model) &&
        (!model.isNewRecord || isAssociationValidation)
      ) {
        return;
      }
      this.normalizeIdentity(model);
      let category: PermitDocumentCategory;
      const today = permitDocumentToday(new Date());
      try {
        category = permitDocumentCategory(model.get('category'));
        model.set('category', category);
        const values = options.inputValues ?? options.values ?? {};
        const companyId = this.identifier(
          Object.prototype.hasOwnProperty.call(values, 'company') ? values.company : model.get('company_id'),
        );
        const relatedId = this.identifier(values.related_document ?? model.get('related_document_id'));
        await this.validateCategory(model, options, values, companyId, relatedId);
      } catch (error) {
        if (!(error instanceof PermitDocumentCategoryError)) throw error;
        throw Object.assign(new Error(error.message), { status: 422, statusCode: 422, code: error.code });
      }
      if (category === 'voluntary') {
        model.set('sync_status', 'NOT_REQUIRED');
        model.set('external_id', null);
        model.set('external_status', null);
        model.set('last_checked_at', null);
        model.set('last_sync_error', null);
        model.set('status', voluntaryDocumentStatus(String(model.get('valid_until')), today));
        model.set(
          'name',
          buildPermitDocumentName(
            String(model.get('title')),
            'certificate_of_conformity',
            String(model.get('valid_from')),
            String(model.get('valid_until')),
          ),
        );
      } else if (model.isNewRecord || this.identityChanged(model) || model.previous('category') === 'voluntary') {
        this.resetRegistryFields(model);
        this.setPendingName(model);
      } else {
        this.restoreManagedFields(model);
      }
      const period = permitDocumentPeriod({
        category,
        validFrom: model.get('valid_from'),
        validUntil: model.get('valid_until'),
        rentalFrom: model.get('rental_from'),
        rentalUntil: model.get('rental_until'),
      });
      model.set('period_from', period.from);
      model.set('period_until', period.until);
      model.set(
        'rental_status',
        category === 'rented' ? (String(model.get('rental_until')) < today ? 'expired' : 'active') : null,
      );
      // Sequelize update restricts writes to the submitted fields unless hook-generated values are included.
      for (const name of [...MANAGED_FIELDS, 'category', 'period_from', 'period_until', 'rental_status']) {
        if (options.fields && model.changed(name) && !options.fields.includes(name)) options.fields.push(name);
      }
      this.validate(model);
    });
    this.plugin.db.on(`${COLLECTION_NAME}.afterUpdate`, async (model: NocoBaseModel, options: HookOptions) => {
      if (
        permitDocumentCategory(model.get('category')) === 'voluntary' ||
        (!this.identityChanged(model) && model.previous('category') !== 'voluntary')
      ) {
        return;
      }
      const documentId = String(model.get('id'));
      await this.repository.clearTechnicalRegulations(documentId, options.transaction);
    });
    this.plugin.db.on(
      `${COLLECTION_NAME}.afterSaveWithAssociations`,
      async (model: NocoBaseModel, options: HookOptions) => {
        if (model.get('category') !== 'voluntary') return;
        // Check saved links inside the same transaction, not just IDs supplied by the form.
        try {
          await this.validateCategory(model, options, {}, model.get('company_id'), model.get('related_document_id'));
        } catch (error) {
          if (!(error instanceof PermitDocumentCategoryError)) throw error;
          throw Object.assign(new Error(error.message), { status: 422, statusCode: 422, code: error.code });
        }
      },
    );
  }

  private identifier(value: unknown): unknown {
    return value && typeof value === 'object' ? (value as { id?: unknown }).id : value;
  }

  private async validateCategory(
    model: NocoBaseModel,
    options: HookOptions,
    values: Record<string, unknown>,
    companyId: unknown,
    relatedDocumentId: unknown,
  ): Promise<void> {
    const category = permitDocumentCategory(model.get('category'));
    const count = async (name: string): Promise<number> => {
      if (Object.prototype.hasOwnProperty.call(values, name)) {
        if (!Array.isArray(values[name])) return 0;
        return (values[name] as unknown[]).filter((item) => this.identifier(item) != null).length;
      }
      if (model.isNewRecord) return 0;
      return this.plugin.db
        .getRepository<MultipleRelationRepository>(`${COLLECTION_NAME}.${name}`, String(model.get('id')))
        .count({ transaction: options.transaction });
    };
    validatePermitDocumentCategory({
      category,
      documentType: model.get('document_type'),
      companyId,
      relatedDocumentId,
      validFrom: model.get('valid_from'),
      validUntil: model.get('valid_until'),
      rentalFrom: model.get('rental_from'),
      rentalUntil: model.get('rental_until'),
      productInformation: model.get('product_information'),
      manufacturerName: model.get('manufacturer_name'),
      manufacturerAddress: model.get('manufacturer_address'),
      regulationCount: category === 'voluntary' ? await count('technical_regulations') : 0,
      attachmentCount: category === 'voluntary' ? await count('documents') : 0,
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

  private setPendingName(model: NocoBaseModel): void {
    const title = model.get('title');
    model.set('name', typeof title === 'string' ? title : null);
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

  private validate(model: NocoBaseModel): void {
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
      throw Object.assign(new Error(ERROR_MESSAGES[error.code]), { status: 422, statusCode: 422, code: error.code });
    }
  }
}
