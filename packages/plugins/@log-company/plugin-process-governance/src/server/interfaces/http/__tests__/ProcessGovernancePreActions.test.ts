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
import { ValidateProcessParents } from '../../../application/ValidateProcessParents';
import { ValidateProcessStatusChange } from '../../../application/ValidateProcessStatusChange';
import type { ProcessGovernanceRepository } from '../../../application/ports/ProcessGovernanceRepository';
import { PROCESS_STATUS_ROLE_NAMES } from '../../../../shared/processStatusPermissions';
import { ProcessGovernancePreActions } from '../ProcessGovernancePreActions';

type PreActionHandler = (context: Record<string, unknown>, next: () => Promise<unknown>) => Promise<void>;

const knownStatusValues = ['queue', 'in_work', 'knr', 'in_russia', 'warehouse', 'release'];

function setup(currentStatus = 'queue') {
  const handlers = new Map<string, PreActionHandler>();
  const plugin = {
    app: {
      resourcer: {
        registerPreActionHandler: (name: string, handler: PreActionHandler) => handlers.set(name, handler),
      },
    },
  } as unknown as Plugin;
  const repository = {
    getProcessStatusValues: () => knownStatusValues,
    findProcess: vi.fn(async () => ({
      id: '10',
      title: 'Process',
      status: currentStatus,
      processNumber: 1,
      carNumber: 'A001',
      chineseClientId: null,
    })),
  } as unknown as ProcessGovernanceRepository;
  new ProcessGovernancePreActions(
    plugin,
    repository,
    new ValidateProcessParents(repository),
    new ValidateProcessStatusChange(repository),
  ).register();
  const handler = handlers.get('customs_processes:update');
  if (!handler) {
    throw new Error('customs_processes:update pre-action was not registered');
  }
  return { handler };
}

function updateContext(roleName: string, status: unknown): Record<string, unknown> {
  return {
    state: { currentRole: roleName, currentRoles: [roleName] },
    action: {
      actionName: 'update',
      params: { filterByTk: '10', values: { status } },
    },
  };
}

describe('ProcessGovernancePreActions status authorization', () => {
  it('lets a manager set a manager status', async () => {
    const { handler } = setup();
    const next = vi.fn(async () => undefined);
    await handler(updateContext(PROCESS_STATUS_ROLE_NAMES.manager, 'in_work'), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 403 when a manager sets a declarant status', async () => {
    const { handler } = setup();
    const next = vi.fn(async () => undefined);
    await expect(
      handler(updateContext(PROCESS_STATUS_ROLE_NAMES.managerIntern, 'warehouse'), next),
    ).rejects.toMatchObject({ status: 403 });
    expect(next).not.toHaveBeenCalled();
  });

  it('lets a declarant set the shared Russia status', async () => {
    const { handler } = setup();
    const next = vi.fn(async () => undefined);
    await handler(updateContext(PROCESS_STATUS_ROLE_NAMES.declarantIntern, 'in_russia'), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('lets a read-only role submit an unchanged status with other form values', async () => {
    const { handler } = setup('queue');
    const next = vi.fn(async () => undefined);
    await handler(updateContext('accountant', 'queue'), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 403 when an unrelated role changes the status', async () => {
    const { handler } = setup('queue');
    await expect(handler(updateContext('accountant', 'in_russia'), async () => undefined)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('returns 422 for a status missing from collection metadata', async () => {
    const { handler } = setup();
    await expect(
      handler(updateContext(PROCESS_STATUS_ROLE_NAMES.declarant, 'not-configured'), async () => undefined),
    ).rejects.toMatchObject({ status: 422 });
  });
});
