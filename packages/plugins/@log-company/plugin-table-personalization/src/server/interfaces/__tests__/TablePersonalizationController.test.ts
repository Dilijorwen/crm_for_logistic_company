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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ColumnSettings } from '../../../shared/contracts';
import { PersonalizationError } from '../../domain/PersonalizationError';
import { TablePersonalizationController } from '../TablePersonalizationController';

const adapters = vi.hoisted(() => ({
  authorize: vi.fn(),
  find: vi.fn(),
  save: vi.fn(),
  reset: vi.fn(),
  update: vi.fn(),
}));
vi.mock('../../infrastructure/NocoBaseTableConfiguration', () => ({
  NocoBaseTableConfiguration: class {
    authorize = adapters.authorize;
  },
}));
vi.mock('../../infrastructure/NocoBasePersonalizationRepository', () => ({
  PERSONALIZATIONS_COLLECTION: 'lc_table_personalizations',
  NocoBasePersonalizationRepository: class {
    find = adapters.find;
    save = adapters.save;
    reset = adapters.reset;
    update = adapters.update;
  },
}));

class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function fixture(
  values: unknown = { identity: { tableUid: 'table', referencePath: [] } },
  userId: string | null = 'current-user',
) {
  const logger = { error: vi.fn() };
  const allow = vi.fn();
  const define = vi.fn();
  const use = vi.fn();
  const plugin = { db: {}, app: { logger, acl: { allow }, resourceManager: { define, use } } } as unknown as Plugin;
  const context = {
    state: { currentUser: userId ? { id: userId } : null },
    action: { params: { values } },
    body: undefined,
    throw(status: number, message: string): never {
      throw new HttpError(status, message);
    },
  } as unknown as Context;
  return { controller: new TablePersonalizationController(plugin), context, logger, allow, define, use };
}

beforeEach(() => {
  vi.resetAllMocks();
  adapters.authorize.mockResolvedValue({
    tableUid: 'table',
    instanceRootUid: 'table',
    instanceKey: 'key',
    schemaSignature: 'a'.repeat(64),
    columns: [],
    existingColumnUids: [],
  });
  adapters.find.mockResolvedValue(null);
  adapters.update.mockImplementation(
    async (_owner: unknown, transform: (previous: ColumnSettings | null) => ColumnSettings) => {
      const settings = transform(null);
      await adapters.save(_owner, settings);
      return settings;
    },
  );
});

describe('personalization HTTP boundary', () => {
  it('saves a bounded width for the authenticated owner through the dedicated action', async () => {
    const { controller, context } = fixture({
      identity: { tableUid: 'table', referencePath: [] },
      columnUid: 'first',
      width: 240,
      schemaSignature: 'a'.repeat(64),
    });
    adapters.authorize.mockResolvedValue({
      tableUid: 'table',
      instanceRootUid: 'table',
      instanceKey: 'key',
      schemaSignature: 'a'.repeat(64),
      columns: [],
      existingColumnUids: ['first'],
      resizableColumnUids: ['first'],
    });
    await controller.handle(context, async () => undefined, 'width');
    expect(context.body).toMatchObject({ settings: { columnWidths: { first: 240 } } });
    expect(adapters.update.mock.calls[0][0].userId).toBe('current-user');
  });

  it.each([{ width: 49 }, { userId: 'victim' }, { columnUid: 'forged' }])(
    'rejects invalid or unauthorized width payload %j',
    async (patch) => {
      const { controller, context } = fixture({
        identity: { tableUid: 'table', referencePath: [] },
        columnUid: 'first',
        width: 240,
        schemaSignature: 'a'.repeat(64),
        ...patch,
      });
      await expect(controller.handle(context, async () => undefined, 'width')).rejects.toMatchObject({
        status: 'columnUid' in patch ? 403 : 400,
      });
      expect(adapters.update).not.toHaveBeenCalled();
    },
  );
  it('returns only current-user preferences and public descriptors', async () => {
    const { controller, context } = fixture();
    await controller.handle(context, async () => undefined, 'get');
    expect(context.body).toMatchObject({ columns: [], settings: null });
    expect(adapters.find.mock.calls[0][0].userId).toBe('current-user');
  });

  it('requires authentication before accessing repositories', async () => {
    const { controller, context } = fixture(undefined, null);
    await expect(controller.handle(context, async () => undefined, 'get')).rejects.toMatchObject({ status: 401 });
    expect(adapters.authorize).not.toHaveBeenCalled();
  });

  it('rejects userId and arbitrary payload keys', async () => {
    const { controller, context } = fixture({ identity: { tableUid: 'table', referencePath: [] }, userId: 'victim' });
    await expect(controller.handle(context, async () => undefined, 'get')).rejects.toMatchObject({ status: 400 });
    expect(adapters.find).not.toHaveBeenCalled();
  });

  it.each([
    ['NOT_FOUND', 404],
    ['FORBIDDEN', 403],
    ['SCHEMA_CHANGED', 409],
  ] as const)('maps %s to %s', async (code, status) => {
    const { controller, context } = fixture();
    adapters.authorize.mockRejectedValue(new PersonalizationError(code));
    await expect(controller.handle(context, async () => undefined, 'get')).rejects.toMatchObject({ status });
  });

  it('logs storage failure and returns a safe error without an internal trace', async () => {
    const { controller, context, logger } = fixture();
    adapters.find.mockRejectedValue(new Error('private SQL path trace'));
    await expect(controller.handle(context, async () => undefined, 'get')).rejects.toMatchObject({
      status: 500,
      message: 'Не удалось обработать настройки столбцов',
    });
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('exposes only dedicated personalization actions', () => {
    const { controller, allow, define, use } = fixture();
    controller.register();
    expect(allow).toHaveBeenCalledWith('tablePersonalizations', ['get', 'save', 'reset', 'width'], 'loggedIn');
    expect(Object.keys(define.mock.calls[0][0].actions)).toEqual(['get', 'save', 'reset', 'width']);
    expect(use).toHaveBeenCalledOnce();
  });

  it.each(['lc_table_personalizations', 'tablePersonalizations'])(
    'blocks generic actions on %s',
    async (resourceName) => {
      const { controller, context, use } = fixture();
      controller.register();
      Object.assign(context.action, { resourceName, actionName: 'list' });
      const guard = use.mock.calls[0][0] as (context: Context, next: () => Promise<void>) => Promise<void>;
      await expect(guard(context, async () => undefined)).rejects.toMatchObject({ status: 403 });
    },
  );
});
