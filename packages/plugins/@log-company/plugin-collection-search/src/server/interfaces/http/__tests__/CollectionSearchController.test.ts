/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import actions, { type Context, type Next } from '@nocobase/actions';
import { createMockDatabase } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import { describe, expect, it, vi } from 'vitest';
import type { NocoBaseSearchIndexRepository } from '../../../infrastructure/persistence/nocobase/NocoBaseSearchIndexRepository';
import { CollectionSearchController } from '../CollectionSearchController';

describe('CollectionSearchController', () => {
  it('returns a Russian validation error and preserves its machine-readable code', async () => {
    let handler: ((context: Context, next: Next) => Promise<void>) | undefined;
    const dataSource = {
      name: 'main',
      resourceManager: {
        registerActionHandler: (_name: string, registeredHandler: typeof handler) => {
          handler = registeredHandler;
        },
      },
      acl: {
        getAvailableAction: () => undefined,
        setAvailableAction: vi.fn(),
      },
      collectionManager: {},
    };
    const logger = { error: vi.fn() };
    const plugin = { app: { logger } } as unknown as Plugin;
    const indexRepository = {} as NocoBaseSearchIndexRepository;
    new CollectionSearchController(plugin, indexRepository).register(dataSource);
    const throwHttpError = vi.fn((status: number, message: string, properties?: Record<string, unknown>) => {
      throw Object.assign(new Error(message), { status, ...properties });
    });
    const context = {
      action: { params: { term: 'ab' } },
      throw: throwHttpError,
    } as unknown as Context;

    await expect(handler?.(context, (async () => undefined) as Next)).rejects.toMatchObject({
      status: 400,
      code: 'SEARCH_TERM_TOO_SHORT',
      message: 'Введите не менее 3 символов',
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('delegates filtering, sorting, ACL and pagination to the standard list action', async () => {
    const database = await createMockDatabase();
    try {
      const collection = database.collection({
        name: 'controller_search_records',
        fields: [
          { type: 'string', name: 'title' },
          { type: 'text', name: 'hidden_comment' },
        ],
      });
      let handler: ((context: Context, next: Next) => Promise<void>) | undefined;
      const setAvailableAction = vi.fn();
      const dataSource = {
        name: 'main',
        resourceManager: {
          registerActionHandler: (_name: string, registeredHandler: typeof handler) => {
            handler = registeredHandler;
          },
        },
        acl: {
          getAvailableAction: () => ({ options: { aliases: ['get'] } }),
          setAvailableAction,
        },
        collectionManager: { db: database },
      };
      const ensureSynchronized = vi.fn(async () => undefined);
      const plugin = { app: { logger: { error: vi.fn() } } } as unknown as Plugin;
      new CollectionSearchController(plugin, {
        ensureSynchronized,
      } as unknown as NocoBaseSearchIndexRepository).register(dataSource);
      const next = vi.fn(async () => undefined);
      const list = vi.spyOn(actions, 'list').mockImplementation(async (_context, actionNext) => {
        await actionNext();
      });
      const context = {
        action: {
          params: {
            searchTerm: 'needle',
            searchFields: JSON.stringify(['hidden_comment']),
            filter: JSON.stringify({ status: 'active' }),
            page: 3,
            pageSize: 50,
            sort: ['-createdAt'],
          },
        },
        permission: { can: { params: { fields: ['title', 'hidden_comment'] } } },
        getCurrentRepository: () => ({ collection }),
      } as unknown as Context;

      await handler?.(context, next as Next);

      expect(ensureSynchronized).toHaveBeenCalledOnce();
      expect(list).toHaveBeenCalledWith(context, next);
      expect(context.action.params).toMatchObject({ page: 3, pageSize: 50, sort: ['-createdAt'] });
      expect(context.action.params.searchTerm).toBeUndefined();
      expect(context.action.params.filter).toEqual({
        $and: [
          { status: 'active' },
          {
            'id.$indexedCollectionSearch': expect.objectContaining({
              term: 'needle',
              searchableFieldNames: ['hidden_comment'],
            }),
          },
        ],
      });
      expect(setAvailableAction).toHaveBeenCalledWith(
        'view',
        expect.objectContaining({ aliases: ['get', 'searchCurrentCollection'] }),
      );
      list.mockRestore();
    } finally {
      await database.close();
    }
  });

  it('treats an empty ACL field list as access to all searchable fields', async () => {
    const database = await createMockDatabase();
    try {
      const collection = database.collection({
        name: 'controller_unrestricted_search_records',
        fields: [
          { type: 'string', name: 'title' },
          { type: 'text', name: 'hidden_comment' },
        ],
      });
      let handler: ((context: Context, next: Next) => Promise<void>) | undefined;
      const dataSource = {
        name: 'main',
        resourceManager: {
          registerActionHandler: (_name: string, registeredHandler: typeof handler) => {
            handler = registeredHandler;
          },
        },
        acl: {
          getAvailableAction: () => undefined,
          setAvailableAction: vi.fn(),
        },
        collectionManager: { db: database },
      };
      const plugin = { app: { logger: { error: vi.fn() } } } as unknown as Plugin;
      new CollectionSearchController(plugin, {
        ensureSynchronized: vi.fn(async () => undefined),
      } as unknown as NocoBaseSearchIndexRepository).register(dataSource);
      const list = vi.spyOn(actions, 'list').mockImplementation(async (_context, actionNext) => {
        await actionNext();
      });
      const context = {
        action: { params: { searchTerm: 'needle' } },
        permission: { can: { params: { fields: [] } } },
        getCurrentRepository: () => ({ collection }),
      } as unknown as Context;

      await handler?.(context, (async () => undefined) as Next);

      expect(context.action.params.filter).toEqual({
        'id.$indexedCollectionSearch': expect.objectContaining({
          searchableFieldNames: ['title', 'hidden_comment'],
        }),
      });
      list.mockRestore();
    } finally {
      await database.close();
    }
  });

  it('includes relation fields moved by NocoBase ACL from fields to appends', async () => {
    const database = await createMockDatabase();
    try {
      const collection = database.collection({
        name: 'controller_relation_acl_records',
        fields: [
          { type: 'string', name: 'title' },
          { type: 'text', name: 'related_value' },
        ],
      });
      let handler: ((context: Context, next: Next) => Promise<void>) | undefined;
      const dataSource = {
        name: 'main',
        resourceManager: {
          registerActionHandler: (_name: string, registeredHandler: typeof handler) => {
            handler = registeredHandler;
          },
        },
        acl: {
          getAvailableAction: () => undefined,
          setAvailableAction: vi.fn(),
        },
        collectionManager: { db: database },
      };
      const plugin = { app: { logger: { error: vi.fn() } } } as unknown as Plugin;
      new CollectionSearchController(plugin, {
        ensureSynchronized: vi.fn(async () => undefined),
      } as unknown as NocoBaseSearchIndexRepository).register(dataSource);
      const list = vi.spyOn(actions, 'list').mockImplementation(async (_context, actionNext) => {
        await actionNext();
      });
      const context = {
        action: {
          params: {
            searchTerm: 'needle',
            searchFields: JSON.stringify(['related_value']),
          },
        },
        permission: { can: { params: { fields: ['title'], appends: ['related_value'] } } },
        getCurrentRepository: () => ({ collection }),
      } as unknown as Context;

      await handler?.(context, (async () => undefined) as Next);

      expect(context.action.params.filter).toEqual({
        'id.$indexedCollectionSearch': expect.objectContaining({
          searchableFieldNames: ['related_value'],
        }),
      });
      list.mockRestore();
    } finally {
      await database.close();
    }
  });

  it('rejects malformed configured search fields', async () => {
    let handler: ((context: Context, next: Next) => Promise<void>) | undefined;
    const dataSource = {
      name: 'main',
      resourceManager: {
        registerActionHandler: (_name: string, registeredHandler: typeof handler) => {
          handler = registeredHandler;
        },
      },
      acl: {
        getAvailableAction: () => undefined,
        setAvailableAction: vi.fn(),
      },
      collectionManager: {},
    };
    const plugin = { app: { logger: { error: vi.fn() } } } as unknown as Plugin;
    new CollectionSearchController(plugin, {} as NocoBaseSearchIndexRepository).register(dataSource);
    const context = {
      action: { params: { searchTerm: 'needle', searchFields: '{broken' } },
      throw(status: number, message: string, properties?: Record<string, unknown>) {
        throw Object.assign(new Error(message), { status, ...properties });
      },
    } as unknown as Context;

    await expect(handler?.(context, (async () => undefined) as Next)).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_SEARCH_FIELDS',
    });
  });
});
