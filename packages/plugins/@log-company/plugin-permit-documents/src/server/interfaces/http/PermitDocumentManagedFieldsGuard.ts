/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';

const NAMESPACE = '@log-company/plugin-permit-documents';
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

export class PermitDocumentManagedFieldsGuard {
  constructor(private readonly plugin: Plugin) {}

  register(): void {
    for (const action of PROTECTED_ACTIONS) {
      this.plugin.app.resourcer.registerPreActionHandler(action, async (context: GuardContext) => {
        context.throw(403, context.t('errors.registryFieldsReadOnly', { ns: NAMESPACE }));
      });
    }
  }
}
