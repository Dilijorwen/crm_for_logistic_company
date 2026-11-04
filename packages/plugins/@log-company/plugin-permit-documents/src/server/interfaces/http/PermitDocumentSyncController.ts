/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { utils, type Context, type Next } from '@nocobase/actions';
import type { Plugin } from '@nocobase/server';
import {
  documentNotFoundMessage,
  registryErrorMessage,
  registryErrorMessages,
} from '../../../contracts/permitDocumentMessages';
import {
  SynchronizePermitDocument,
  type SynchronizePermitDocumentResult,
} from '../../application/SynchronizePermitDocument';

export const PERMIT_DOCUMENT_SYNC_ACTION = 'sync';
const RESOURCE_NAME = 'permit_documents';

interface AvailableAction {
  options: { aliases?: string | string[] };
}

function aliases(value: string | string[] | undefined): string[] {
  return value ? (Array.isArray(value) ? value : [value]) : [];
}

export class PermitDocumentSyncController {
  constructor(
    private readonly plugin: Plugin,
    private readonly synchronize: SynchronizePermitDocument,
  ) {}

  register(): void {
    this.plugin.app.resourceManager.define({
      name: RESOURCE_NAME,
      actions: { [PERMIT_DOCUMENT_SYNC_ACTION]: this.sync },
    });
    const updateAction = this.plugin.app.acl.getAvailableAction('update') as AvailableAction | undefined;
    if (updateAction) {
      this.plugin.app.acl.setAvailableAction('update', {
        ...updateAction.options,
        aliases: Array.from(new Set([...aliases(updateAction.options.aliases), PERMIT_DOCUMENT_SYNC_ACTION])),
      });
    }
  }

  private readonly sync = async (context: Context, next: Next): Promise<void> => {
    const params = context.action?.params || {};
    const documentId = params.filterByTk ?? params.resourceIndex;
    if (documentId === null || documentId === undefined || String(documentId).trim().length === 0) {
      context.throw(400, 'Не указан документ для проверки.');
      return;
    }
    if (!['string', 'number', 'bigint'].includes(typeof documentId) || !/^[1-9]\d*$/.test(String(documentId))) {
      context.throw(400, 'Указан некорректный документ для проверки. Обновите таблицу и выберите документ заново.');
      return;
    }
    const repository = utils.getRepositoryFromParams(context);
    const permittedRecord = await repository.findOne({
      filterByTk: documentId,
      filter: params.filter,
      fields: ['id'],
      context,
    });
    if (!permittedRecord) {
      context.throw(404, 'Документ не найден или недоступен.');
      return;
    }
    let result: SynchronizePermitDocumentResult;
    try {
      result = await this.synchronize.execute(String(permittedRecord.get('id')));
    } catch (error) {
      this.plugin.app.logger.error('[permit-documents] Manual synchronization failed.', {
        documentId: String(permittedRecord.get('id')),
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      context.throw(503, 'Сервис проверки временно недоступен. Повторите проверку позже.');
      return;
    }
    if (result === 'MISSING') {
      context.throw(404, 'Документ не найден или недоступен.');
      return;
    }
    if (result === 'STALE') {
      context.throw(409, 'Во время проверки изменился номер, тип или категория документа. Повторите проверку.');
      return;
    }
    context.status = 200;
    if (result === 'ERROR') {
      const checked = await repository.findOne({
        filterByTk: documentId,
        filter: params.filter,
        fields: ['last_sync_error'],
        context,
      });
      const savedCode: unknown = checked?.get('last_sync_error');
      const errorCode =
        typeof savedCode === 'string' && Object.prototype.hasOwnProperty.call(registryErrorMessages, savedCode)
          ? savedCode
          : 'INTERNAL_SYNC_ERROR';
      context.body = { syncStatus: result, errorCode, message: registryErrorMessage(errorCode) };
    } else {
      context.body = {
        syncStatus: result,
        message:
          result === 'NOT_FOUND'
            ? documentNotFoundMessage
            : result === 'NOT_REQUIRED'
              ? 'Для добровольного документа проверка по реестру не требуется.'
              : 'Документ проверен. Сведения обновлены.',
      };
    }
    await next();
  };
}
