/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createUserProvider, parseJsonTemplate } from '@nocobase/acl';
import type { Context } from '@nocobase/actions';
import type { Filter } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import type { Transaction } from 'sequelize';
import type {
  PermitDocumentPairAccess,
  PermitNumberingTransaction,
} from '../../application/ports/PermitDocumentNumberingRepository';
import { PermitDocumentNumberingError } from '../../domain/permit-document/PermitDocumentNumbering';

interface PairAuthorizationContext extends Context {
  can?: (options: { resource: string; action: string }) => { params?: { filter?: Filter; fields?: string[] } } | null;
}

export class NocoBasePermitDocumentPairAccess implements PermitDocumentPairAccess {
  constructor(private readonly plugin: Plugin) {}

  async assertCanLink(documentId: string, rawContext: unknown, transaction: PermitNumberingTransaction): Promise<void> {
    // Repository calls without HTTP context are trusted server operations (imports and migrations).
    if (rawContext == null) return;
    const context = rawContext as PairAuthorizationContext;
    const permission = context.can?.({ resource: 'permit_documents', action: 'update' });
    if (!permission) this.deny();
    const fields = permission.params?.fields;
    if (fields && !fields.includes('related_document') && !fields.includes('related_document_id')) this.deny();
    const rawFilter = permission.params?.filter;
    if (!rawFilter) return;
    const filter = await parseJsonTemplate(rawFilter, {
      state: context.state,
      timezone: context.get('x-timezone'),
      userProvider: createUserProvider({ db: context.db || this.plugin.db, currentUser: context.state?.currentUser }),
    });
    const document = await this.plugin.db.getRepository('permit_documents').findOne({
      filterByTk: documentId,
      filter: filter ?? rawFilter,
      transaction: transaction as Transaction,
    });
    if (!document) this.deny();
  }

  private deny(): never {
    throw new PermitDocumentNumberingError(
      'RELATED_DOCUMENT_ACCESS_DENIED',
      'Нет прав на связь с выбранным документом.',
    );
  }
}
