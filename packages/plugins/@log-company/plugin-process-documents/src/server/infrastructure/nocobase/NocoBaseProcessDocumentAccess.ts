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
import type { Plugin } from '@nocobase/server';
import type { Filter } from '@nocobase/database';
import { ProcessDocumentsError } from '../../domain/documents/DocumentErrors';
import type { ProcessDocumentAccess, ProcessDocumentOperation } from '../../application/ports/ProcessDocumentAccess';
import type { DocumentActor } from '../../application/ports/ProcessDocumentsRepository';

const SHIPMENTS_COLLECTION = 'shipments';

interface PermissionResult {
  params?: {
    filter?: Filter;
  };
}

interface NocoBaseAuthorizationContext extends Context {
  can?: (input: { resource: string; action: string }) => PermissionResult | null;
}

export class NocoBaseProcessDocumentAccess implements ProcessDocumentAccess {
  constructor(private readonly plugin: Plugin) {}

  async assertAccess(shipmentId: string, operation: ProcessDocumentOperation, actor: DocumentActor): Promise<void> {
    if (actor.isRoot) {
      return;
    }

    const context = actor.authorizationContext as NocoBaseAuthorizationContext;
    const permission = context.can?.({ resource: SHIPMENTS_COLLECTION, action: this.actionFor(operation) });
    if (!permission) {
      throw new ProcessDocumentsError('SHIPMENT_ACCESS_DENIED', 'Нет прав для действия с документами поставки.');
    }

    const rawFilter = permission.params?.filter;
    const filter = rawFilter
      ? (await parseJsonTemplate(rawFilter, {
          state: context.state,
          timezone: context.get('x-timezone'),
          userProvider: createUserProvider({
            db: context.db || this.plugin.db,
            currentUser: context.state?.currentUser,
          }),
        })) ?? rawFilter
      : null;
    if (!filter) {
      return;
    }

    const shipment = await this.plugin.db.getRepository(SHIPMENTS_COLLECTION).findOne({
      filterByTk: shipmentId,
      filter,
    });
    if (!shipment) {
      throw new ProcessDocumentsError('SHIPMENT_ACCESS_DENIED', 'Нет прав для действия с документами поставки.');
    }
  }

  private actionFor(operation: ProcessDocumentOperation): string {
    if (operation === 'read') {
      return 'get';
    }
    if (operation === 'delete') {
      return 'destroy';
    }
    return 'update';
  }
}
