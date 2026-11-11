/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import {
  permitDocumentIdentifier,
  PermitDocumentNumberingError,
} from '../../domain/permit-document/PermitDocumentNumbering';

const PROTECTED_ACTIONS = [
  'permit_documents.technical_regulations:add',
  'permit_documents.technical_regulations:set',
  'permit_documents.technical_regulations:remove',
  'technical_regulations.permit_documents:add',
  'technical_regulations.permit_documents:set',
  'technical_regulations.permit_documents:remove',
  'document_technical_regulations:create',
  'document_technical_regulations:update',
  'document_technical_regulations:destroy',
] as const;

interface GuardContext {
  t(key: string, options: { ns: string }): string;
  throw(status: number, message: string): never;
}

function selectionIdentifier(value: unknown, label: string): string | null {
  try {
    return permitDocumentIdentifier(value);
  } catch (error) {
    if (!(error instanceof PermitDocumentNumberingError)) throw error;
    throw Object.assign(new Error(`Выберите существующую запись в поле «${label}».`), {
      status: 422,
      statusCode: 422,
      code: 'INVALID_SELECTED_RECORD',
    });
  }
}

export class PermitDocumentManagedFieldsGuard {
  constructor(private readonly plugin: Plugin) {}

  register(): void {
    for (const action of PROTECTED_ACTIONS) {
      this.plugin.app.resourcer.registerPreActionHandler(action, async (rawContext) => {
        const context = rawContext as unknown as GuardContext;
        context.throw(403, 'Изменяйте технические регламенты через форму разрешительного документа.');
      });
    }
    for (const action of ['create', 'update']) {
      this.plugin.app.resourcer.registerPreActionHandler(`permit_documents:${action}`, async (context, next) => {
        const payload: unknown = context.action?.params.values;
        const parameters = context.action?.params;
        for (const raw of Array.isArray(payload) ? payload : [payload]) {
          if (!raw || typeof raw !== 'object') continue;
          const values = raw as Record<string, unknown>;
          const current =
            action === 'update' && parameters?.filterByTk != null
              ? await this.plugin.db
                  .getRepository('permit_documents')
                  .findOne({ filterByTk: parameters.filterByTk, filter: parameters.filter })
              : null;
          const category = values.category ?? current?.get('category') ?? 'ordinary';
          if ('technical_regulations' in values) {
            if (!Array.isArray(values.technical_regulations)) context.throw(422, 'Выберите технические регламенты.');
            const ids = [
              ...new Set(
                (values.technical_regulations as unknown[]).map((value) =>
                  selectionIdentifier(value, 'Технические регламенты'),
                ),
              ),
            ];
            if (action === 'create' && category !== 'voluntary') {
              if (ids.length) {
                context.throw(403, 'Технические регламенты этого документа заполняются из реестра.');
              }
              delete values.technical_regulations;
            } else {
              if (ids.length) {
                const count = await this.plugin.db
                  .getRepository('technical_regulations')
                  .count({ filter: { id: { $in: ids } } });
                if (ids.includes(null) || count !== ids.length) {
                  context.throw(422, 'Один из выбранных технических регламентов не найден.');
                }
              }
              values.technical_regulations = ids;
            }
          }
          if (category === 'voluntary' && Array.isArray(values.documents)) {
            values.documents = values.documents.map((value) => selectionIdentifier(value, 'Документы'));
          }
        }
        await next();
      });
    }
  }
}
