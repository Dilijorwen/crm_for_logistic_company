/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Context, Next } from '@nocobase/actions';
import type { Plugin } from '@nocobase/server';
import type { SynchronizePermitDocument } from '../../application/SynchronizePermitDocument';
import type { PermitDocumentRepository } from '../../application/ports/PermitDocumentRepository';
import type { SyncLogger } from '../../application/ports/PermitDocumentSyncSupport';

const RESOURCE_NAME = 'permit_documents';
const CREATE_ACTION = 'create';
const UPDATE_ACTION = 'update';

interface ModelLike {
  get(key: string): unknown;
}

export class PermitDocumentSubmitSyncMiddleware {
  constructor(
    private readonly plugin: Plugin,
    private readonly repository: PermitDocumentRepository,
    private readonly synchronize: Pick<SynchronizePermitDocument, 'execute'>,
    private readonly logger: SyncLogger,
  ) {}

  register(): void {
    this.plugin.app.resourceManager.use(this.handle, {
      tag: 'log-company.permit-documents.sync-after-submit',
      after: 'acl',
    });
  }

  private readonly handle = async (context: Context, next: Next): Promise<void> => {
    const { resourceName, actionName, params = {} } = context.action || {};
    if (resourceName !== RESOURCE_NAME || (actionName !== CREATE_ACTION && actionName !== UPDATE_ACTION)) {
      await next();
      return;
    }

    const updateDocumentId = actionName === UPDATE_ACTION ? this.toDocumentId(params.filterByTk) : null;
    const identityBeforeUpdate = updateDocumentId ? await this.repository.findById(updateDocumentId) : null;

    await next();

    if (actionName === CREATE_ACTION) {
      const createdDocumentId = this.documentIdFromBody(context.body);
      if (createdDocumentId) {
        await this.synchronizeSafely(createdDocumentId);
      }
      return;
    }

    if (!updateDocumentId || !identityBeforeUpdate) {
      return;
    }
    const identityAfterUpdate = await this.repository.findById(updateDocumentId);
    if (
      identityAfterUpdate &&
      (identityAfterUpdate.title !== identityBeforeUpdate.title ||
        identityAfterUpdate.documentType !== identityBeforeUpdate.documentType)
    ) {
      await this.synchronizeSafely(updateDocumentId);
    }
  };

  private async synchronizeSafely(documentId: string): Promise<void> {
    try {
      await this.synchronize.execute(documentId);
    } catch (error) {
      this.logger.error('Failed to synchronize permit document after submit.', {
        documentId,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  private documentIdFromBody(body: unknown, depth = 0): string | null {
    if (depth > 3 || body === null || body === undefined) {
      return null;
    }
    if (Array.isArray(body)) {
      for (const item of body) {
        const documentId = this.documentIdFromBody(item, depth + 1);
        if (documentId) {
          return documentId;
        }
      }
      return null;
    }
    if (typeof body !== 'object') {
      return null;
    }
    const getter = (body as { get?: unknown }).get;
    if (typeof getter === 'function') {
      const documentId = this.toDocumentId(Reflect.apply(getter, body as ModelLike, ['id']));
      if (documentId) {
        return documentId;
      }
    }
    const record = body as { id?: unknown; data?: unknown };
    return this.toDocumentId(record.id) || this.documentIdFromBody(record.data, depth + 1);
  }

  private toDocumentId(value: unknown): string | null {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
      return null;
    }
    const documentId = String(value).trim();
    return documentId.length > 0 ? documentId : null;
  }
}
