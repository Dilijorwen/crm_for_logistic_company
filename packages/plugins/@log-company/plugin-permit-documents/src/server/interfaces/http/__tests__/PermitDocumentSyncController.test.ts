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
import type {
  SynchronizePermitDocument,
  SynchronizePermitDocumentResult,
} from '../../../application/SynchronizePermitDocument';
import { PermitDocumentSyncController } from '../PermitDocumentSyncController';

type ActionHandler = (context: Context, next: Next) => Promise<void>;

function fixture(
  record: { get(key: string): unknown } | null,
  synchronizationResult: SynchronizePermitDocumentResult = 'SUCCESS',
) {
  let handler: ActionHandler | null = null;
  const repository = { findOne: vi.fn().mockResolvedValue(record) };
  const acl = {
    getAvailableAction: vi.fn().mockReturnValue({ options: { type: 'new-data', aliases: ['edit'] } }),
    setAvailableAction: vi.fn(),
  };
  const plugin = {
    app: {
      resourceManager: {
        define: vi.fn((resource: { actions: { sync: ActionHandler } }) => {
          handler = resource.actions.sync;
        }),
      },
      acl,
    },
  } as unknown as Plugin;
  const synchronize = {
    execute: vi.fn().mockResolvedValue(synchronizationResult),
  } as unknown as SynchronizePermitDocument;
  new PermitDocumentSyncController(plugin, synchronize).register();
  if (!handler) {
    throw new Error('Sync action was not registered.');
  }
  const context = {
    action: {
      resourceName: 'permit_documents',
      actionName: 'sync',
      params: { filterByTk: '10', filter: { company_id: 'allowed-company' } },
    },
    db: { getRepository: () => repository },
    t: (key: string) => key,
    throw: (status: number, message: string) => {
      throw Object.assign(new Error(message), { status });
    },
  } as unknown as Context;
  return { handler, context, repository, synchronize, acl };
}

describe('PermitDocumentSyncController', () => {
  it('aliases sync to update so regular record permissions are used', () => {
    const { acl } = fixture(null);
    expect(acl.setAvailableAction).toHaveBeenCalledWith(
      'update',
      expect.objectContaining({ aliases: expect.arrayContaining(['edit', 'sync']) }),
    );
  });

  it('returns 404 when the ACL-scoped filter hides the record', async () => {
    const { handler, context, repository, synchronize } = fixture(null);
    await expect(handler(context, vi.fn())).rejects.toMatchObject({ status: 404 });
    expect(repository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ filter: { company_id: 'allowed-company' } }),
    );
    expect(synchronize.execute).not.toHaveBeenCalled();
  });

  it('waits for an accessible record synchronization and returns its final status', async () => {
    const { handler, context, synchronize } = fixture({ get: () => '10' });
    const next = vi.fn();
    await handler(context, next);
    expect(synchronize.execute).toHaveBeenCalledWith('10');
    expect(context.status).toBe(200);
    expect(context.body).toEqual({ syncStatus: 'SUCCESS' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 404 when the record disappears during synchronization', async () => {
    const { handler, context } = fixture({ get: () => '10' }, 'MISSING');
    await expect(handler(context, vi.fn())).rejects.toMatchObject({ status: 404 });
  });

  it('returns 409 when the document identity changes during synchronization', async () => {
    const { handler, context } = fixture({ get: () => '10' }, 'STALE');
    await expect(handler(context, vi.fn())).rejects.toMatchObject({ status: 409 });
  });
});
