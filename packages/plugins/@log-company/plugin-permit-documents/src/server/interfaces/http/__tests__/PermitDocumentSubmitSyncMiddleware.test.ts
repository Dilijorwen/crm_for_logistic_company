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
  PermitDocumentRepository,
  PermitDocumentSnapshot,
} from '../../../application/ports/PermitDocumentRepository';
import type { SyncLogger } from '../../../application/ports/PermitDocumentSyncSupport';
import { PermitDocumentSubmitSyncMiddleware } from '../PermitDocumentSubmitSyncMiddleware';

type Middleware = (context: Context, next: Next) => Promise<void>;

function snapshot(title: string, documentType = 'declaration_of_conformity'): PermitDocumentSnapshot {
  return {
    id: '42',
    title,
    documentType,
    externalId: null,
    syncStatus: 'PENDING',
    status: null,
    lastCheckedAt: null,
  };
}

function fixture() {
  let handle: Middleware | null = null;
  const use = vi.fn((middleware: Middleware) => {
    handle = middleware;
  });
  const plugin = { app: { resourceManager: { use } } } as unknown as Plugin;
  const repository = { findById: vi.fn() } as unknown as PermitDocumentRepository;
  const synchronize = { execute: vi.fn().mockResolvedValue('SUCCESS') };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as SyncLogger;
  new PermitDocumentSubmitSyncMiddleware(plugin, repository, synchronize, logger).register();
  if (!handle) {
    throw new Error('Submit synchronization middleware was not registered.');
  }
  return { handle, use, repository, synchronize, logger };
}

function context(actionName: string, params: Record<string, unknown> = {}): Context {
  return {
    action: { resourceName: 'permit_documents', actionName, params },
    body: null,
  } as unknown as Context;
}

describe('PermitDocumentSubmitSyncMiddleware', () => {
  it('starts creation synchronization only after the submit action completes', async () => {
    const { handle, synchronize } = fixture();
    const requestContext = context('create');
    let completeSubmit: (() => void) | null = null;
    const submit = new Promise<void>((resolve) => {
      completeSubmit = resolve;
    });
    const execution = handle(requestContext, async () => {
      await submit;
      requestContext.body = { data: { id: '42' } };
    });

    await Promise.resolve();
    expect(synchronize.execute).not.toHaveBeenCalled();
    completeSubmit?.();
    await execution;

    expect(synchronize.execute).toHaveBeenCalledWith('42');
  });

  it('synchronizes an update submitted with a changed document identity', async () => {
    const { handle, repository, synchronize } = fixture();
    vi.mocked(repository.findById)
      .mockResolvedValueOnce(snapshot('DOC-OLD'))
      .mockResolvedValueOnce(snapshot('DOC-NEW'));

    await handle(context('update', { filterByTk: '42' }), async () => undefined);

    expect(synchronize.execute).toHaveBeenCalledWith('42');
  });

  it('does not synchronize an update when the submitted identity is unchanged', async () => {
    const { handle, repository, synchronize } = fixture();
    vi.mocked(repository.findById).mockResolvedValue(snapshot('DOC-SAME'));

    await handle(context('update', { filterByTk: '42' }), async () => undefined);

    expect(synchronize.execute).not.toHaveBeenCalled();
  });

  it('does not synchronize when submit fails', async () => {
    const { handle, synchronize } = fixture();

    await expect(
      handle(context('create'), async () => {
        throw new Error('validation failed');
      }),
    ).rejects.toThrow('validation failed');

    expect(synchronize.execute).not.toHaveBeenCalled();
  });

  it('keeps a successful submit response when synchronization infrastructure throws', async () => {
    const { handle, synchronize, logger } = fixture();
    synchronize.execute.mockRejectedValue(new Error('registry unavailable'));
    const requestContext = context('create');

    await expect(
      handle(requestContext, async () => {
        requestContext.body = { id: '42' };
      }),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith('Failed to synchronize permit document after submit.', {
      documentId: '42',
      errorName: 'Error',
    });
  });
});
