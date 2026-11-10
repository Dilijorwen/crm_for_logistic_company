/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Context } from '@nocobase/actions';
import type { Plugin } from '@nocobase/server';
import { describe, expect, it, vi } from 'vitest';
import { TableFilterTemplates } from '../../application/TableFilterTemplates';
import { FilterTemplateError } from '../../domain/FilterTemplateError';
import { PersonalizationError } from '../../domain/PersonalizationError';
import { TableFilterTemplateController } from '../TableFilterTemplateController';

function fixture(userId: number | null = 1, roles = ['member']) {
  const execute = vi.fn().mockResolvedValue({ templates: [], schemaSignature: 'signature' });
  const create = vi.fn().mockReturnValue({ execute } as unknown as TableFilterTemplates);
  const app = {
    acl: { allow: vi.fn() },
    resourceManager: { define: vi.fn(), use: vi.fn() },
    logger: { error: vi.fn() },
  };
  const context = {
    method: 'POST',
    state: { currentUser: userId ? { id: userId } : null, currentRoles: roles },
    action: {
      resourceName: 'tableFilterTemplates',
      actionName: 'list',
      params: { values: { identity: { tableUid: 'table', referencePath: [] } } },
    },
    throw(status: number, message: string): never {
      throw Object.assign(new Error(message), { status });
    },
  } as unknown as Context;
  const controller = new TableFilterTemplateController({ app } as unknown as Plugin, create, [
    'lc_table_filter_templates',
    'lc_table_template_initializations',
  ]);
  return { controller, context, create, execute, app };
}

describe('filter template HTTP boundary', () => {
  it('returns a useful validation error for invalid column settings', async () => {
    const { controller, context, execute } = fixture();
    execute.mockRejectedValue(new PersonalizationError('INVALID_SETTINGS'));
    await expect(controller.handle(context, async () => undefined, 'create')).rejects.toMatchObject({
      status: 400,
      message: 'Некорректный идентификатор таблицы или настройки колонок',
    });
  });
  it('uses authenticated state for the owner even for root', async () => {
    const { controller, context, create } = fixture(1, ['root']);
    await controller.handle(context, async () => undefined, 'list');
    expect(create).toHaveBeenCalledWith(context, '1');
    expect(context.body).toEqual({ templates: [], schemaSignature: 'signature' });
  });

  it('requires authentication', async () => {
    const { controller, context, create } = fixture(null);
    await expect(controller.handle(context, async () => undefined, 'list')).rejects.toMatchObject({ status: 401 });
    expect(create).not.toHaveBeenCalled();
  });

  it.each([undefined, 'another-template'])('rejects a missing or mismatched update key (%s)', async (filterByTk) => {
    const { controller, context, create } = fixture();
    context.action.params.filterByTk = filterByTk;
    context.action.params.values = { id: 'template' };
    await expect(controller.handle(context, async () => undefined, 'update')).rejects.toMatchObject({ status: 400 });
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    ['INVALID_TEMPLATE', 400],
    ['FORBIDDEN', 403],
    ['NOT_FOUND', 404],
    ['CONFLICT', 409],
    ['DUPLICATE_NAME', 409],
  ] as const)('maps %s to HTTP %s', async (code, status) => {
    const { controller, context, execute } = fixture();
    execute.mockRejectedValue(new FilterTemplateError(code));
    await expect(controller.handle(context, async () => undefined, 'create')).rejects.toMatchObject({ status });
  });

  it('logs repository failures and does not expose their details', async () => {
    const { controller, context, execute, app } = fixture();
    execute.mockRejectedValue(new Error('private SQL trace'));
    await expect(controller.handle(context, async () => undefined, 'create')).rejects.toMatchObject({
      status: 500,
      message: 'Не удалось обработать шаблоны таблицы',
    });
    expect(app.logger.error).toHaveBeenCalledOnce();
  });

  it.each([
    ['lc_table_filter_templates', 'list', 'POST'],
    ['lc_table_filter_templates', 'update', 'POST'],
    ['lc_table_template_initializations', 'list', 'POST'],
    ['tableFilterTemplates', 'destroy', 'POST'],
    ['tableFilterTemplates', 'create', 'GET'],
  ])('blocks generic or unsafe access: %s:%s via %s', async (resourceName, actionName, method) => {
    const { controller, context, app } = fixture();
    controller.register();
    Object.assign(context.action, { resourceName, actionName });
    context.method = method;
    const guard = app.resourceManager.use.mock.calls[0][0] as (
      context: Context,
      next: () => Promise<void>,
    ) => Promise<void>;
    await expect(guard(context, async () => undefined)).rejects.toMatchObject({ status: 403 });
  });
});
