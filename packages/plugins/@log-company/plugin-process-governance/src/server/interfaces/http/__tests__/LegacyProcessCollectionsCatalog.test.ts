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
import { LegacyProcessCollectionsCatalog } from '../LegacyProcessCollectionsCatalog';

function fixture(resourceName = 'roles.dataSourcesCollections', dataSourceKey = 'main', usesLegacyProcesses = false) {
  let middleware: (context: Context, next: Next) => Promise<void>;
  const plugin = {
    db: { getCollection: () => (usesLegacyProcesses ? {} : undefined) },
    app: {
      resourceManager: {
        use: (handler: typeof middleware) => {
          middleware = handler;
        },
      },
    },
  } as unknown as Plugin;
  new LegacyProcessCollectionsCatalog(plugin).register();
  const rows = [
    'process_history',
    'process_comments',
    'customs_process_managers',
    'shipments',
    'shipment_comments',
    'process_documents',
    'process_document_folders',
  ].map((name) => ({ name }));
  const context = {
    action: { resourceName, actionName: 'list', params: { filter: { dataSourceKey }, pageSize: 20 } },
    body: { rows, count: rows.length, totalPage: 1 },
  } as unknown as Context;
  return { context, run: (next: Next = async () => undefined) => middleware(context, next) };
}

describe('legacy process collection role catalog', () => {
  it.each(['roles.dataSourcesCollections', 'roles.collections'])(
    'removes only retired collections from %s',
    async (name) => {
      const { context, run } = fixture(name);
      const next = vi.fn();
      await run(next);
      expect(next).toHaveBeenCalledOnce();
      expect(context.body).toEqual({
        rows: ['shipments', 'shipment_comments', 'process_documents', 'process_document_folders'].map((name) => ({
          name,
        })),
        count: 4,
        totalPage: 1,
      });
    },
  );

  it.each([
    ['roles.dataSourcesCollections', 'external', false],
    ['roles.dataSourcesCollections', 'main', true],
    ['collections', 'main', false],
  ] as const)('preserves unrelated or still-used catalogs: %s/%s/%s', async (...args) => {
    const { context, run } = fixture(...args);
    const previous: unknown = context.body;
    await run();
    expect(context.body).toBe(previous);
  });

  it('does not suppress an authorization failure', async () => {
    const { run } = fixture();
    await expect(
      run(async () => {
        throw new Error('FORBIDDEN');
      }),
    ).rejects.toThrow('FORBIDDEN');
  });
});
