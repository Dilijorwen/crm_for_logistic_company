/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Context, Next } from '@nocobase/actions';
import { describe, expect, it, vi } from 'vitest';
import { AuthorizeSearchConfigurationChange } from '../../../application/AuthorizeSearchConfigurationChange';
import type { SearchFlowModelRepository } from '../../../application/ports/SearchFlowModelRepository';
import { SearchConfigurationGuard } from '../SearchConfigurationGuard';

class EmptySearchFlowModelRepository implements SearchFlowModelRepository {
  async containsSearchAction(): Promise<boolean> {
    return false;
  }
}

class ExistingSearchFlowModelRepository implements SearchFlowModelRepository {
  async containsSearchAction(modelUids: string[]): Promise<boolean> {
    return modelUids.includes('search-action');
  }
}

function context(input: {
  resourceName: string;
  actionName: string;
  role: string;
  values?: Record<string, unknown>;
}): Context {
  return {
    action: {
      params: {
        resourceName: input.resourceName,
        actionName: input.actionName,
        values: input.values,
      },
    },
    state: { currentRole: input.role, currentRoles: [input.role] },
    throw(status: number, message: string) {
      throw Object.assign(new Error(message), { status });
    },
  } as unknown as Context;
}

describe('SearchConfigurationGuard', () => {
  const guard = new SearchConfigurationGuard(
    new AuthorizeSearchConfigurationChange(new EmptySearchFlowModelRepository()),
  );

  it('allows an ordinary user to execute collection search', async () => {
    const next = vi.fn(async () => undefined);

    await guard.handle(
      context({ resourceName: 'shipments', actionName: 'searchCurrentCollection', role: 'member' }),
      next as Next,
    );

    expect(next).toHaveBeenCalledOnce();
  });

  it('forbids an ordinary user from saving search action configuration', async () => {
    const next = vi.fn(async () => undefined);

    await expect(
      guard.handle(
        context({
          resourceName: 'flowModels',
          actionName: 'save',
          role: 'member',
          values: { use: 'CollectionSearchActionModel', props: { searchWidth: 600 } },
        }),
        next as Next,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(next).not.toHaveBeenCalled();
  });

  it('forbids updating an existing search action even if use is omitted from the payload', async () => {
    const existingModelGuard = new SearchConfigurationGuard(
      new AuthorizeSearchConfigurationChange(new ExistingSearchFlowModelRepository()),
    );
    const next = vi.fn(async () => undefined);

    await expect(
      existingModelGuard.handle(
        context({
          resourceName: 'flowModels',
          actionName: 'save',
          role: 'member',
          values: { uid: 'search-action', props: { searchWidth: 600 } },
        }),
        next as Next,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows root to save search action configuration', async () => {
    const next = vi.fn(async () => undefined);

    await guard.handle(
      context({
        resourceName: 'flowModels',
        actionName: 'save',
        role: 'root',
        values: { use: 'CollectionSearchActionModel', props: { searchWidth: 600 } },
      }),
      next as Next,
    );

    expect(next).toHaveBeenCalledOnce();
  });
});
