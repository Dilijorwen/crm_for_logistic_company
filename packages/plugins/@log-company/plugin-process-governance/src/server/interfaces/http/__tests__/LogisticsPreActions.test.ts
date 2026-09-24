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
import { ValidateRunParents } from '../../../application/logistics/ValidateRunParents';
import { ValidateShipmentDeletion } from '../../../application/logistics/ValidateShipmentDeletion';
import type { LogisticsRepository } from '../../../application/logistics/ports/LogisticsRepository';
import { LogisticsPreActions } from '../LogisticsPreActions';

type PreActionHandler = (context: Record<string, unknown>, next: () => Promise<unknown>) => Promise<void>;

function setup(linkedRunCount = 0) {
  const handlers = new Map<string, PreActionHandler>();
  const plugin = {
    app: {
      resourcer: {
        registerPreActionHandler: (name: string, handler: PreActionHandler) => handlers.set(name, handler),
      },
    },
  } as unknown as Plugin;
  const repository = {
    getRunParentIds: vi.fn(async () => []),
    lockRunParentGraph: vi.fn(async () => undefined),
    runParentSelectionCreatesCycle: vi.fn(async () => false),
    countShipmentRunLinks: vi.fn(async () => linkedRunCount),
  } as unknown as LogisticsRepository;
  new LogisticsPreActions(
    plugin,
    repository,
    new ValidateRunParents(repository),
    new ValidateShipmentDeletion(repository),
  ).register();
  return { handlers };
}

describe('LogisticsPreActions', () => {
  it('denies manual creation of shipment history even if ACL was configured incorrectly', async () => {
    const { handlers } = setup();
    const next = vi.fn(async () => undefined);
    const handler = handlers.get('shipment_history:create');
    if (!handler) {
      throw new Error('shipment_history:create pre-action was not registered');
    }

    await expect(handler({}, next)).rejects.toMatchObject({ status: 403 });
    expect(next).not.toHaveBeenCalled();
  });

  it('denies manual deletion of run history without blocking internal cascades', async () => {
    const { handlers } = setup();
    const next = vi.fn(async () => undefined);
    const handler = handlers.get('transport_run_history:destroy');
    if (!handler) {
      throw new Error('transport_run_history:destroy pre-action was not registered');
    }

    await expect(handler({}, next)).rejects.toMatchObject({ status: 403 });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns a conflict and an actionable message when a shipment is still linked', async () => {
    const { handlers } = setup(2);
    const next = vi.fn(async () => undefined);
    const handler = handlers.get('shipments:destroy');
    if (!handler) {
      throw new Error('shipments:destroy pre-action was not registered');
    }

    await expect(handler({ action: { params: { filterByTk: 'shipment-1' } } }, next)).rejects.toMatchObject({
      status: 409,
      message:
        'Нельзя удалить поставку, пока она связана с рейсами. Удалите связанные рейсы или уберите поставку из них.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks a self-reference before changing the run relation', async () => {
    const { handlers } = setup();
    const next = vi.fn(async () => undefined);
    const handler = handlers.get('transport_runs.parent_runs:add');
    if (!handler) {
      throw new Error('transport_runs.parent_runs:add pre-action was not registered');
    }

    await expect(
      handler({ action: { actionName: 'add', sourceId: 'run-1', params: { values: ['run-1'] } } }, next),
    ).rejects.toMatchObject({ status: 400, message: 'Нельзя выбрать текущий рейс как родительский.' });
    expect(next).not.toHaveBeenCalled();
  });
});
