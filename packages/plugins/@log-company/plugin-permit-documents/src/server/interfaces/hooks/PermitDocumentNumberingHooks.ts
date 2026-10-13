/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import type { AssignPermitDocumentNumber } from '../../application/AssignPermitDocumentNumber';
import type {
  PermitDocumentNumberingRepository,
  PermitNumberingTransaction,
} from '../../application/ports/PermitDocumentNumberingRepository';
import {
  assertPermitDocumentNumberingUnchanged,
  permitDocumentIdentifier,
  PermitDocumentNumberingError,
} from '../../domain/permit-document/PermitDocumentNumbering';

interface NumberingModel {
  isNewRecord: boolean;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

interface NumberingHookOptions {
  transaction?: PermitNumberingTransaction;
  context?: unknown;
  values?: Record<string, unknown>;
  inputValues?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  skip?: readonly string[];
}

export class PermitDocumentNumberingHooks {
  constructor(
    private readonly plugin: Plugin,
    private readonly repository: PermitDocumentNumberingRepository,
    private readonly assign: AssignPermitDocumentNumber,
  ) {}

  register(): void {
    this.plugin.db.on(
      'permit_documents.beforeValidate',
      async (model: NumberingModel, options: NumberingHookOptions) => {
        if (model.get('title') == null && options.skip?.includes('title')) return;
        await this.handleErrors(async () => {
          const transaction = this.transaction(options);
          if (model.isNewRecord) {
            const values = options.inputValues ?? options.values ?? {};
            const relatedDocumentId = this.relatedIdentifier(values, model.get('related_document_id'));
            // Metadata can rebind the ID field after this hook; NocoBase generates it later in beforeValidate.
            const documentId = permitDocumentIdentifier(model.get('id'));
            const internalNumber = await this.assign.execute({
              documentId,
              relatedDocumentId,
              transaction,
              context: options.context,
            });
            model.set('internal_number', internalNumber);
            model.set('related_document_id', relatedDocumentId);
          } else {
            const saved = await this.repository.findById(String(model.get('id')), transaction);
            if (!saved) return;
            const values = options.inputValues ?? options.values ?? {};
            assertPermitDocumentNumberingUnchanged(
              {
                internalNumber:
                  model.get('internal_number') === undefined ? saved.internalNumber : model.get('internal_number'),
                relatedDocumentId: this.relatedIdentifier(
                  values,
                  model.get('related_document_id') === undefined
                    ? saved.relatedDocumentId
                    : model.get('related_document_id'),
                ),
              },
              saved,
            );
          }
        });
      },
    );
    this.plugin.db.on('permit_documents.afterCreate', async (model: NumberingModel, options: NumberingHookOptions) => {
      const relatedDocumentId = permitDocumentIdentifier(model.get('related_document_id'));
      if (relatedDocumentId) {
        await this.handleErrors(() =>
          this.repository.completePair(String(model.get('id')), relatedDocumentId, this.transaction(options)),
        );
      }
    });
    this.plugin.db.on('permit_documents.beforeBulkDestroy', async (options: NumberingHookOptions) => {
      await this.repository.lock(this.transaction(options));
    });
    this.plugin.db.on(
      'permit_documents.beforeDestroy',
      async (_model: NumberingModel, options: NumberingHookOptions) => {
        await this.repository.lock(this.transaction(options));
      },
    );
    this.plugin.db.on('permit_documents.beforeBulkUpdate', (options: NumberingHookOptions) => {
      if ('internal_number' in (options.attributes ?? {}) || 'related_document_id' in (options.attributes ?? {})) {
        throw Object.assign(new Error('Внутренний номер и связанный документ недоступны для изменения.'), {
          status: 422,
          code: 'PERMIT_NUMBERING_READ_ONLY',
        });
      }
    });
    for (const action of ['add', 'set', 'remove', 'toggle', 'create', 'update', 'destroy']) {
      this.plugin.app.resourcer.registerPreActionHandler(
        `permit_documents.related_document:${action}`,
        async (context) => {
          context.throw(422, 'Связанный документ можно выбрать только при создании.');
        },
      );
    }
    for (const action of ['create', 'update']) {
      this.plugin.app.resourcer.registerPreActionHandler(`permit_documents:${action}`, async (context, next) => {
        await this.handleErrors(async () => {
          const payload: unknown = context.action.params.values;
          for (const item of Array.isArray(payload) ? payload : [payload]) {
            if (item && typeof item === 'object' && Object.prototype.hasOwnProperty.call(item, 'related_document')) {
              // A selection only carries identity; nested values must never edit the other document.
              const values = item as Record<string, unknown>;
              values.related_document = permitDocumentIdentifier(values.related_document);
            }
          }
        });
        await next();
      });
    }
  }

  private relatedIdentifier(values: Record<string, unknown>, fallback: unknown): string | null {
    const hasRelation = Object.prototype.hasOwnProperty.call(values, 'related_document');
    const hasForeignKey = Object.prototype.hasOwnProperty.call(values, 'related_document_id');
    const relation = hasRelation
      ? permitDocumentIdentifier(values.related_document)
      : permitDocumentIdentifier(fallback);
    if (hasForeignKey) {
      const foreignKey = permitDocumentIdentifier(values.related_document_id);
      if (hasRelation && foreignKey !== relation) {
        throw new PermitDocumentNumberingError('INVALID_RELATED_DOCUMENT', 'Переданы разные связанные документы.');
      }
      return foreignKey;
    }
    return relation;
  }

  private transaction(options: NumberingHookOptions): PermitNumberingTransaction {
    if (!options.transaction) throw new Error('Permit numbering requires a transaction.');
    return options.transaction;
  }

  private async handleErrors(work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      if (error instanceof PermitDocumentNumberingError) {
        const status =
          error.code === 'RELATED_DOCUMENT_ACCESS_DENIED'
            ? 403
            : error.code === 'RELATED_DOCUMENT_NOT_FOUND'
              ? 404
              : 422;
        throw Object.assign(new Error(error.message), { status, statusCode: status, code: error.code });
      }
      throw error;
    }
  }
}
