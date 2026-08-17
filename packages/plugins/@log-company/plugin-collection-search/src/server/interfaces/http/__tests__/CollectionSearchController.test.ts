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
import { describe, expect, it, vi } from 'vitest';
import type { NocoBaseSearchIndexRepository } from '../../../infrastructure/persistence/nocobase/NocoBaseSearchIndexRepository';
import { CollectionSearchController } from '../CollectionSearchController';

describe('CollectionSearchController', () => {
  it('localizes validation errors and preserves their machine-readable code', async () => {
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
    const translate = vi.fn((key: string) => `translated:${key}`);
    const throwHttpError = vi.fn((status: number, message: string, properties?: Record<string, unknown>) => {
      throw Object.assign(new Error(message), { status, ...properties });
    });
    const context = {
      action: { params: { term: 'ab' } },
      t: translate,
      throw: throwHttpError,
    } as unknown as Context;

    await expect(handler?.(context, (async () => undefined) as Next)).rejects.toMatchObject({
      status: 400,
      code: 'SEARCH_TERM_TOO_SHORT',
      message: 'translated:errors.SEARCH_TERM_TOO_SHORT',
    });
    expect(translate).toHaveBeenCalledWith('errors.SEARCH_TERM_TOO_SHORT', {
      ns: '@log-company/plugin-collection-search',
    });
    expect(logger.error).not.toHaveBeenCalled();
  });
});
