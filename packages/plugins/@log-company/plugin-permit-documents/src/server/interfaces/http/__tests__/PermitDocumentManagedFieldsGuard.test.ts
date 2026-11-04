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
  function fixture() {
    type Context = {
      action: { params: { values: Record<string, unknown> } };
      throw(status: number, message: string): never;
    };
    const handlers = new Map<string, (context: Context, next: () => Promise<void>) => Promise<void>>();
    const plugin = {
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
      action: { params: { values } },
      throw: (status, message) => {
        throw Object.assign(new Error(message), { status });
      },
    });
    const handler = handlers.get('permit_documents:create');
    if (!handler) throw new Error('Create guard was not registered.');
    return { handler, context };
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
});
