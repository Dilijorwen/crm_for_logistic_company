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
import { record } from '../../shared/contracts';
import { TablePersonalizations } from '../application/TablePersonalizations';
import { PersonalizationError } from '../domain/PersonalizationError';
import { NocoBaseTableConfiguration } from '../infrastructure/NocoBaseTableConfiguration';
import {
  NocoBasePersonalizationRepository,
  PERSONALIZATIONS_COLLECTION,
} from '../infrastructure/NocoBasePersonalizationRepository';

type Operation = 'get' | 'save' | 'reset' | 'width';
const ERRORS = {
  INVALID_SETTINGS: [400, 'Некорректные настройки столбцов'],
  NOT_FOUND: [404, 'Таблица не найдена'],
  FORBIDDEN: [403, 'Нет доступа к таблице или её столбцам'],
  SCHEMA_CHANGED: [409, 'Состав или права на столбцы изменились. Проверьте настройки и повторите сохранение'],
} as const;

export class TablePersonalizationController {
  constructor(private readonly plugin: Plugin) {}

  register(): void {
    const actions = Object.fromEntries(
      (['get', 'save', 'reset', 'width'] as const).map((operation) => [
        operation,
        async (context: Context, next: Next) => this.handle(context, next, operation),
      ]),
    );
    this.plugin.app.resourceManager.define({ name: 'tablePersonalizations', actions });
    this.plugin.app.acl.allow('tablePersonalizations', ['get', 'save', 'reset', 'width'], 'loggedIn');
    // The metadata collection is private even when a role grants generic collection actions.
    this.plugin.app.resourceManager.use(
      async (context, next) => {
        if (context.action?.resourceName === PERSONALIZATIONS_COLLECTION) {
          context.throw(403, 'Прямой доступ к персональным настройкам запрещён');
        }
        if (
          context.action?.resourceName === 'tablePersonalizations' &&
          !['get', 'save', 'reset', 'width'].includes(context.action.actionName)
        ) {
          context.throw(403, 'Действие с персональными настройками запрещено');
        }
        await next();
      },
      { tag: 'log-company.table-personalization-private', after: 'auth', before: 'acl' },
    );
  }

  async handle(context: Context, next: Next, operation: Operation): Promise<void> {
    const userId: unknown = context.state.currentUser?.id;
    if (typeof userId !== 'string' && typeof userId !== 'number') context.throw(401, 'Требуется вход в систему');
    try {
      const values = record(context.action.params.values);
      const keys =
        operation === 'save'
          ? ['identity', 'settings', 'schemaSignature']
          : operation === 'width'
            ? ['identity', 'columnUid', 'width', 'schemaSignature']
            : ['identity'];
      if (Object.keys(values).some((key) => !keys.includes(key)) || keys.some((key) => !(key in values))) {
        throw new PersonalizationError('INVALID_SETTINGS');
      }
      const useCase = new TablePersonalizations(
        new NocoBaseTableConfiguration(this.plugin, context),
        new NocoBasePersonalizationRepository(this.plugin.db),
        String(userId),
      );
      context.body = await useCase.execute(operation, {
        identity: values.identity,
        settings: values.settings,
        schemaSignature: values.schemaSignature,
        columnUid: values.columnUid,
        width: values.width,
      });
    } catch (error) {
      if (error instanceof PersonalizationError) {
        const [status, message] = ERRORS[error.code];
        context.throw(status, message, { code: error.code });
      }
      this.plugin.app.logger.error('[table-personalization] Operation failed', {
        operation,
        error: error instanceof Error ? error.message : String(error),
      });
      context.throw(500, 'Не удалось обработать настройки столбцов');
    }
    await next();
  }
}
