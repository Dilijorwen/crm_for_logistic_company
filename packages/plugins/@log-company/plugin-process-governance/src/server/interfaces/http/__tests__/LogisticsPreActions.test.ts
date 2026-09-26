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
  it('keeps a run save from overwriting shipments with stale nested snapshots', async () => {
    const { handlers } = setup();
    const next = vi.fn(async () => undefined);
    const handler = handlers.get('transport_runs:update');
    if (!handler) {
      throw new Error('transport_runs:update pre-action was not registered');
    }
    const params = {
      values: {
        status: 'in_work',
        shipments: [
          {
            id: 'shipment-1',
            display_name: 'Старое название',
            chinese_client: { id: 'old-client', name: 'Старый клиент' },
            chinese_client_id: 'old-client',
          },
          { id: 'shipment-2', display_name: 'Ещё одно старое название' },
        ],
      },
      updateAssociationValues: ['shipments', 'shipments.chinese_client', 'managers'],
    };

    await handler({ action: { actionName: 'update', params } }, next);

    expect(params.values).toEqual({
      status: 'in_work',
      shipments: ['shipment-1', 'shipment-2'],
    });
    expect(params.updateAssociationValues).toEqual(['managers']);
    expect(next).toHaveBeenCalledOnce();
  });

  it('preserves an explicit request to clear all shipment links from a run', async () => {
    const { handlers } = setup();
    const next = vi.fn(async () => undefined);
    const handler = handlers.get('transport_runs:update');
    if (!handler) {
      throw new Error('transport_runs:update pre-action was not registered');
    }
    const params = {
      values: { shipments: [] },
      updateAssociationValues: ['shipments'],
    };

    await handler({ action: { actionName: 'update', params } }, next);

    expect(params.values).toEqual({ shipments: [] });
    expect(params.updateAssociationValues).toEqual([]);
    expect(next).toHaveBeenCalledOnce();
  });

  it('keeps shipment forms from updating selected reference records', async () => {
    const { handlers } = setup();
    const next = vi.fn(async () => undefined);
    const handler = handlers.get('shipments:update');
    if (!handler) {
      throw new Error('shipments:update pre-action was not registered');
    }
    const params = {
      values: {
        chinese_client: { name: 'Клиент без доступного ID' },
        company: { id: 'company-1', name: 'Компания' },
        invoice_number: 'INV-1',
      },
      updateAssociationValues: ['chinese_client', 'company', 'company.responsible_user', 'comments'],
    };

    await handler({ action: { actionName: 'update', params } }, next);

    expect(params.values).toEqual({ company: 'company-1', invoice_number: 'INV-1' });
    expect(params.updateAssociationValues).toEqual(['comments']);
    expect(next).toHaveBeenCalledOnce();
  });

  it('converts reference objects to IDs when a shipment is created inside a run', async () => {
    const { handlers } = setup();
    const next = vi.fn(async () => undefined);
    const handler = handlers.get('transport_runs.shipments:create');
    if (!handler) {
      throw new Error('transport_runs.shipments:create pre-action was not registered');
    }
    const params = {
      values: {
        chinese_client: { id: 'client-1', name: 'Клиент' },
        company: { id: 'company-1', name: 'Компания' },
      },
      updateAssociationValues: ['chinese_client', 'company'],
    };

    await handler({ action: { actionName: 'create', params } }, next);

    expect(params.values).toEqual({ chinese_client: 'client-1', company: 'company-1' });
    expect(params.updateAssociationValues).toEqual([]);
    expect(next).toHaveBeenCalledOnce();
  });

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
