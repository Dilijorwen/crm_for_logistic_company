/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import { ResourceManager } from '@nocobase/resourcer';
import { describe, expect, it, vi } from 'vitest';
import type { AssignPermitDocumentNumber } from '../../../application/AssignPermitDocumentNumber';
import type { PermitDocumentNumberingRepository } from '../../../application/ports/PermitDocumentNumberingRepository';
import { PermitDocumentNumberingHooks } from '../PermitDocumentNumberingHooks';

describe('permit document numbering HTTP guards', () => {
  function fixture() {
    const handlers = new Map<string, (context: unknown, next: () => Promise<void>) => Promise<void>>();
    const plugin = {
      db: { on: vi.fn() },
      app: {
        resourcer: {
          registerPreActionHandler: (
            action: string,
            handler: (context: unknown, next: () => Promise<void>) => Promise<void>,
          ) => handlers.set(action, handler),
        },
      },
    };
    new PermitDocumentNumberingHooks(
      plugin as unknown as Plugin,
      {} as PermitDocumentNumberingRepository,
      {} as AssignPermitDocumentNumber,
    ).register();
    return handlers;
  }

  it('reduces a selected record to its ID so nested payloads cannot edit the other document', async () => {
    const handlers = fixture();
    const values = { related_document: { id: '123', title: 'Injected change' } };
    const next = vi.fn(async () => {});
    await handlers.get('permit_documents:create')?.({ action: { params: { values } } }, next);
    expect(values.related_document).toBe('123');
    expect(next).toHaveBeenCalledOnce();
  });

  it.each(['create', 'update'])('continues the %s action with and without a selected document', async (action) => {
    const resourcer = new ResourceManager();
    const savedValues: Record<string, unknown>[] = [];
    resourcer.define({
      name: 'permit_documents',
      actions: {
        async [action](context, next) {
          savedValues.push(context.action.params.values);
          context.body = { id: '456', ...context.action.params.values };
          await next();
        },
      },
    });
    new PermitDocumentNumberingHooks(
      { db: { on: vi.fn() }, app: { resourcer } } as unknown as Plugin,
      {} as PermitDocumentNumberingRepository,
      {} as AssignPermitDocumentNumber,
    ).register();
    for (const values of [
      { title: 'Документ', document_type: 'certificate_of_conformity' },
      { title: 'Документ', related_document: { id: '123', title: 'Injected change' } },
    ]) {
      const resourceAction = resourcer.getAction('permit_documents', action).clone();
      resourceAction.mergeParams({ values });
      const context = { body: undefined, action: resourceAction };
      await resourceAction.execute(context);
      expect(context.body).toMatchObject({ id: '456', title: 'Документ' });
    }
    expect(savedValues).toEqual([
      { title: 'Документ', document_type: 'certificate_of_conformity' },
      { title: 'Документ', related_document: '123' },
    ]);
  });

  it('rejects multiple references and direct association mutations', async () => {
    const handlers = fixture();
    const next = vi.fn(async () => {});
    await expect(
      handlers.get('permit_documents:create')?.(
        { action: { params: { values: { related_document: ['1', '2'] } } } },
        next,
      ),
    ).rejects.toMatchObject({ status: 422, code: 'INVALID_RELATED_DOCUMENT' });
    expect(next).not.toHaveBeenCalled();
    const context = {
      throw: (status: number, message: string) => {
        throw Object.assign(new Error(message), { status });
      },
    };
    await expect(handlers.get('permit_documents.related_document:set')?.(context, next)).rejects.toMatchObject({
      status: 422,
    });
  });
});
