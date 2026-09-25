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
import { NormalizeShipmentNumericFields } from '../../../application/logistics/NormalizeShipmentNumericFields';
import type { LogisticsRepository } from '../../../application/logistics/ports/LogisticsRepository';
import { LogisticsHooks, type LogisticsHookActions } from '../LogisticsHooks';

interface TestModel {
  isNewRecord: boolean;
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
  values: Record<string, unknown>;
  dataValues?: Record<string, unknown>;
}

type HookHandler = (model: TestModel, options: Record<string, unknown>) => Promise<void> | void;

function createModel(values: Record<string, unknown>): TestModel {
  return {
    isNewRecord: true,
    values: { ...values },
    get(key) {
      return this.values[key];
    },
    set(key, value) {
      this.values[key] = value;
    },
  };
}

function setup() {
  const handlers = new Map<string, HookHandler>();
  const plugin = {
    db: {
      on: (event: string, handler: HookHandler) => handlers.set(event, handler),
      getCollection: (name: string) => (name === 'transport_runs' ? { name } : undefined),
    },
  } as unknown as Plugin;
  const repository = {
    getTrackedFields: vi.fn(() => []),
    getRunRegistrationNumbers: vi.fn(async () => new Map()),
  } as unknown as LogisticsRepository;
  const actions = {
    assignNumber: { execute: vi.fn(async () => 17) },
    resolveRunVehicle: {
      execute: vi.fn(async () => ({ vehicleId: 'vehicle-1', registrationNumber: 'AB/123-CD' })),
    },
    captureSnapshot: { execute: vi.fn(async () => undefined) },
    normalizeShipmentNumericFields: new NormalizeShipmentNumericFields(),
    recordCreated: { execute: vi.fn(async () => undefined) },
    recordFieldChanges: { execute: vi.fn(async () => undefined) },
    recordRelationChange: { execute: vi.fn(async () => undefined) },
    validateRunParents: { execute: vi.fn(async () => undefined) },
    validateShipmentContract: { execute: vi.fn(async () => undefined) },
    validateShipmentDeletion: { execute: vi.fn(async () => undefined) },
    refreshShipmentDisplayName: {
      execute: vi.fn(async () => '17/Клиент/—/—/—'),
      executeForClient: vi.fn(async () => undefined),
    },
  } as unknown as LogisticsHookActions;

  new LogisticsHooks(plugin, repository, actions).register();
  return { actions, handlers, repository };
}

describe('LogisticsHooks', () => {
  it('assigns the run number and vehicle before Sequelize validates required columns', async () => {
    const { actions, handlers } = setup();
    const handler = handlers.get('transport_runs.beforeValidate');
    if (!handler) {
      throw new Error('transport_runs.beforeValidate hook was not registered');
    }
    const model = createModel({ registration_number_input: 'АВ/123-СD' });

    await handler(model, { inputValues: { registration_number_input: 'АВ/123-СD' } });

    expect(model.values).toMatchObject({
      run_number: 17,
      vehicle_id: 'vehicle-1',
      registration_number_input: 'AB/123-CD',
      status: 'queue',
    });
    expect(actions.assignNumber.execute).toHaveBeenCalledOnce();
    expect(actions.resolveRunVehicle.execute).toHaveBeenCalledWith({
      registrationNumber: 'АВ/123-СD',
      transaction: undefined,
    });
  });

  it('prepares a new model only once when Sequelize validates it repeatedly', async () => {
    const { actions, handlers } = setup();
    const handler = handlers.get('transport_runs.beforeValidate');
    if (!handler) {
      throw new Error('transport_runs.beforeValidate hook was not registered');
    }
    const model = createModel({ registration_number_input: 'AB123CD' });

    await handler(model, { inputValues: { registration_number_input: 'AB123CD' } });
    await handler(model, { inputValues: { registration_number_input: 'AB123CD' } });

    expect(actions.assignNumber.execute).toHaveBeenCalledOnce();
    expect(actions.resolveRunVehicle.execute).toHaveBeenCalledOnce();
  });

  it('assigns the shipment number before required fields are validated', async () => {
    const { actions, handlers } = setup();
    const handler = handlers.get('shipments.beforeValidate');
    if (!handler) {
      throw new Error('shipments.beforeValidate hook was not registered');
    }
    const model = createModel({ chinese_client_id: 'client-1', company_id: 'company-1' });

    await handler(model, {});

    expect(model.values.shipment_number).toBe(17);
    expect(actions.assignNumber.execute).toHaveBeenCalledWith(
      expect.objectContaining({ entityKind: 'shipment', isNewRecord: true }),
    );
    expect(actions.resolveRunVehicle.execute).not.toHaveBeenCalled();
  });

  it('projects shipment associations into foreign keys before Sequelize validates required columns', async () => {
    const { actions, handlers } = setup();
    const handler = handlers.get('shipments.beforeValidate');
    if (!handler) {
      throw new Error('shipments.beforeValidate hook was not registered');
    }
    const model = createModel({});

    await handler(model, {
      values: {
        chinese_client: { id: 'client-1', name: 'Клиент' },
        company: { id: 'company-1', name: 'Компания' },
        contract_record: { id: 'contract-1', name: 'Контракт' },
        customs_warehouse: null,
      },
    });

    expect(model.values).toMatchObject({
      shipment_number: 17,
      chinese_client_id: 'client-1',
      company_id: 'company-1',
      contract_id: 'contract-1',
      customs_warehouse_id: null,
    });
    expect(actions.validateShipmentContract.execute).toHaveBeenCalledWith({
      companyId: 'company-1',
      contractId: 'contract-1',
      transaction: undefined,
    });
  });

  it('normalizes comma and dot decimals before Sequelize validates a shipment', async () => {
    const { handlers } = setup();
    const handler = handlers.get('shipments.beforeValidate');
    if (!handler) {
      throw new Error('shipments.beforeValidate hook was not registered');
    }
    const model = createModel({ chinese_client_id: 'client-1', company_id: 'company-1' });

    await handler(model, {
      values: {
        invoice_value: '1,0',
        customs_payments_amount: '2.5',
        eco_fee: null,
      },
    });

    expect(model.values).toMatchObject({
      invoice_value: 1,
      customs_payments_amount: 2.5,
      eco_fee: null,
    });
  });

  it('returns a safe validation error for an invalid shipment decimal', async () => {
    const { handlers } = setup();
    const handler = handlers.get('shipments.beforeValidate');
    if (!handler) {
      throw new Error('shipments.beforeValidate hook was not registered');
    }
    const model = createModel({ chinese_client_id: 'client-1', company_id: 'company-1' });

    await expect(handler(model, { values: { invoice_value: '1,2.3' } })).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining('Стоимость по инвойсу'),
    });
  });

  it('projects the related vehicle number into the only editable run field', async () => {
    const { handlers, repository } = setup();
    const handler = handlers.get('afterFind');
    if (!handler) {
      throw new Error('afterFind hook was not registered');
    }
    const model = createModel({ id: 'run-1' });
    model.dataValues = model.values;
    Object.defineProperty(model, 'constructor', { value: { name: 'transport_runs' } });
    vi.mocked(repository.getRunRegistrationNumbers).mockResolvedValue(new Map([['run-1', 'AB123CD']]));

    await handler(model, {});

    expect(model.values.registration_number_input).toBe('AB123CD');
    expect(repository.getRunRegistrationNumbers).toHaveBeenCalledWith(['run-1']);
  });
});
