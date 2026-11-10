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
import type { FilterTemplateOperation } from '../../shared/filterTemplates';
import type { TableFilterTemplates } from '../application/TableFilterTemplates';
import { FilterTemplateError } from '../domain/FilterTemplateError';
import { PersonalizationError } from '../domain/PersonalizationError';

const OPERATIONS: FilterTemplateOperation[] = ['list', 'create', 'rename', 'update', 'delete'];
const ERRORS = {
  INVALID_TEMPLATE: [400, 'Проверьте название, условия и колонки шаблона'],
  INVALID_SETTINGS: [400, 'Некорректный идентификатор таблицы или настройки колонок'],
  FORBIDDEN: [403, 'Нет доступа к таблице, полям фильтра или изменению шаблона'],
  NOT_FOUND: [404, 'Таблица или шаблон не найдены'],
  CONFLICT: [409, 'Шаблон уже изменён. Обновите список и повторите действие'],
  DUPLICATE_NAME: [409, 'Шаблон с таким названием уже существует в этой таблице'],
  SCHEMA_CHANGED: [409, 'Настройки таблицы изменились. Обновите страницу'],
} as const;

export class TableFilterTemplateController {
  constructor(
    private readonly plugin: Plugin,
    private readonly createUseCase: (context: Context, userId: string) => TableFilterTemplates,
    private readonly metadataCollections: readonly string[],
  ) {}

  register(): void {
    this.plugin.app.resourceManager.define({
      name: 'tableFilterTemplates',
      actions: Object.fromEntries(
        OPERATIONS.map((operation) => [
          operation,
          (context: Context, next: Next) => this.handle(context, next, operation),
        ]),
      ),
    });
    this.plugin.app.acl.allow('tableFilterTemplates', OPERATIONS, 'loggedIn');
    this.plugin.app.resourceManager.use(
      async (context, next) => {
        if (
          this.metadataCollections.includes(context.action?.resourceName ?? '') ||
          (context.action?.resourceName === 'tableFilterTemplates' &&
            (!OPERATIONS.includes(context.action.actionName as FilterTemplateOperation) || context.method !== 'POST'))
        )
          context.throw(403, 'Прямой доступ к шаблонам фильтров запрещён');
        await next();
      },
      { tag: 'log-company.table-filter-templates-private', after: 'auth', before: 'acl' },
    );
  }

  async handle(context: Context, next: Next, operation: FilterTemplateOperation): Promise<void> {
    const userId: unknown = context.state.currentUser?.id;
    if (typeof userId !== 'string' && typeof userId !== 'number') context.throw(401, 'Требуется вход в систему');
    const { filterByTk, values } = context.action.params;
    if (operation === 'update' && (typeof filterByTk !== 'string' || filterByTk !== record(values).id)) {
      context.throw(400, ERRORS.INVALID_TEMPLATE[1], { code: 'INVALID_TEMPLATE' });
    }
    try {
      context.body = await this.createUseCase(context, String(userId)).execute(operation, values);
    } catch (error) {
      if (error instanceof FilterTemplateError || error instanceof PersonalizationError) {
        const [status, message] = ERRORS[error.code];
        context.throw(status, message, { code: error.code });
      }
      this.plugin.app.logger.error('[table-filter-templates] Operation failed', {
        operation,
        userId: String(userId),
        error: error instanceof Error ? error.message : String(error),
      });
      context.throw(500, 'Не удалось обработать шаблоны таблицы');
    }
    await next();
  }
}
