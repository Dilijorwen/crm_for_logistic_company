/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import { describe, expect, it, vi } from 'vitest';
import { PermitDocumentManagedFieldsGuard } from '../PermitDocumentManagedFieldsGuard';

describe('permit document manual association guard', () => {
  function fixture(action: 'create' | 'update' = 'create', category = 'ordinary') {
    type Context = {
      action: { params: { values: Record<string, unknown>; filterByTk?: string } };
      throw(status: number, message: string): never;
    };
    const handlers = new Map<string, (context: Context, next: () => Promise<void>) => Promise<void>>();
    const plugin = {
      db: {
        getRepository: () => ({
          findOne: async () => ({ get: (key: string) => (key === 'category' ? category : '100') }),
          count: async ({ filter }: { filter: { id: { $in: unknown[] } } }) =>
            filter.id.$in.filter((id) => ['1', '2'].includes(String(id))).length,
        }),
      },
      app: {
        resourcer: {
          registerPreActionHandler: (
            name: string,
            handler: (context: Context, next: () => Promise<void>) => Promise<void>,
          ) => handlers.set(name, handler),
        },
      },
    };
    new PermitDocumentManagedFieldsGuard(plugin as unknown as Plugin).register();
    const context = (values: Record<string, unknown>): Context => ({
      action: { params: { values, ...(action === 'update' ? { filterByTk: '100' } : {}) } },
      throw: (status, message) => {
        throw Object.assign(new Error(message), { status });
      },
    });
    const handler = handlers.get(`permit_documents:${action}`);
    if (!handler) throw new Error('Submit guard was not registered.');
    return { handler, context, handlers };
  }
  it('normalizes manual association selections without allowing nested dictionary or file edits', async () => {
    const { handler, context } = fixture();
    const values = {
      category: 'voluntary',
      technical_regulations: [{ id: '1', doc_num: 'Injected' }],
      documents: [{ id: '2', filename: 'Injected' }],
    };
    const next = vi.fn(async () => {});
    await handler(context(values), next);
    expect(values.technical_regulations).toEqual(['1']);
    expect(values.documents).toEqual(['2']);
    expect(next).toHaveBeenCalledOnce();
  });
  it('rejects manual regulations for registry-backed documents before calling the action', async () => {
    const { handler, context } = fixture();
    const next = vi.fn(async () => {});
    await expect(handler(context({ category: 'rented', technical_regulations: ['1'] }), next)).rejects.toMatchObject({
      status: 403,
    });
    expect(next).not.toHaveBeenCalled();
  });
  it.each(['ordinary', 'rented'])(
    'accepts existing regulation selections and clearing on %s edit',
    async (category) => {
      const { handler, context } = fixture('update', category);
      const values = { technical_regulations: [{ id: '1', doc_num: 'Injected' }, { id: '1' }] };
      const next = vi.fn(async () => {});
      await handler(context(values), next);
      expect(values.technical_regulations).toEqual(['1']);
      await handler(context({ technical_regulations: [] }), next);
      expect(next).toHaveBeenCalledTimes(2);
    },
  );
  it.each([
    { selection: ['999'] },
    { selection: [null] },
    { selection: [{ doc_num: 'ТР ТС 008/2011' }] },
    { selection: '1' },
  ])('rejects missing or invalid regulation selections %j', async ({ selection }) => {
    const { handler, context } = fixture('update');
    const next = vi.fn(async () => {});
    await expect(handler(context({ technical_regulations: selection }), next)).rejects.toMatchObject({
      status: 422,
    });
    expect(next).not.toHaveBeenCalled();
  });
  it('keeps direct relation and join-table actions protected', async () => {
    const { handlers, context } = fixture('update');
    for (const [name, handler] of handlers) {
      if (name === 'permit_documents:create' || name === 'permit_documents:update') continue;
      const next = vi.fn(async () => {});
      await expect(handler(context({}), next)).rejects.toMatchObject({ status: 403 });
      expect(next).not.toHaveBeenCalled();
    }
  });
});
