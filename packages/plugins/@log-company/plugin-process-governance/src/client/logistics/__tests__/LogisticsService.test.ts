/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { APIClient } from '@nocobase/client';
import { describe, expect, it, vi } from 'vitest';
import { LogisticsService } from '../LogisticsService';

interface ResourceStub {
  list: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  add: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
}

function setup() {
  const resources = new Map<string, ResourceStub>();
  const api = {
    resource(name: string, sourceId?: string) {
      const key = sourceId ? `${name}:${sourceId}` : name;
      const existing = resources.get(key);
      if (existing) {
        return existing;
      }
      const resource = {
        list: vi.fn(async () => ({ data: { data: [] } })),
        create: vi.fn(async () => ({ data: { data: {} } })),
        update: vi.fn(async () => undefined),
        destroy: vi.fn(async () => undefined),
        add: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined),
      };
      resources.set(key, resource);
      return resource;
    },
  } as unknown as APIClient;
  return { service: new LogisticsService(api), resources, api };
}

describe('LogisticsService', () => {
  it('loads the projected machine number without exposing the vehicle association as a form field', async () => {
    const { service, api } = setup();
    const runs = api.resource('transport_runs') as unknown as ResourceStub;
    runs.list.mockResolvedValue({
      data: {
        data: [
          {
            id: '101',
            run_number: 7,
            status: 'queue',
            registration_number_input: 'AB123CD',
          },
        ],
      },
    });

    await expect(service.getRuns()).resolves.toMatchObject([
      {
        id: '101',
        runNumber: 7,
        registrationNumber: 'AB123CD',
      },
    ]);
    expect(runs.list).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.arrayContaining(['registration_number_input']),
      }),
    );
  });

  it('maps a run form to the normalized NocoBase associations', async () => {
    const { service, resources, api } = setup();
    const runs = api.resource('transport_runs') as unknown as ResourceStub;
    runs.create.mockResolvedValue({ data: { data: { id: '101', run_number: 7, status: 'queue' } } });

    await service.createRun({
      registrationNumber: 'AB123CD',
      status: 'queue',
      departureCityId: '20',
      managerIds: ['2', '3'],
      declarantIds: [],
      parentRunIds: ['99'],
    });

    expect(resources.get('transport_runs')?.create).toHaveBeenCalledWith({
      values: {
        registration_number_input: 'AB123CD',
        status: 'queue',
        departure_city: { id: '20' },
        managers: [{ id: '2' }, { id: '3' }],
        declarants: [],
        parent_runs: [{ id: '99' }],
      },
    });
  });

  it('normalizes a shipment returned through the run association', async () => {
    const { service, api } = setup();
    const shipments = api.resource('transport_runs.shipments', 'run-1') as unknown as ResourceStub;
    shipments.list.mockResolvedValue({
      data: {
        data: [
          {
            id: 'shipment-1',
            shipment_number: 12,
            chinese_client: { id: 'client-1', name: 'Клиент' },
            company: { id: 'company-1', name: 'Компания' },
            route_delivery_number: 'DEL-10',
            documents_in_badis: true,
          },
        ],
      },
    });

    await expect(service.getRunShipments('run-1')).resolves.toMatchObject([
      {
        id: 'shipment-1',
        shipmentNumber: 12,
        chineseClient: { id: 'client-1', label: 'Клиент' },
        company: { id: 'company-1', label: 'Компания' },
        routeDeliveryNumber: 'DEL-10',
        documentsInBadis: true,
      },
    ]);
  });

  it('uses add and remove without deleting the shipment', async () => {
    const { service, api } = setup();
    const relation = api.resource('transport_runs.shipments', 'run-1') as unknown as ResourceStub;

    await service.attachShipments('run-1', ['shipment-1']);
    await service.detachShipment('run-1', 'shipment-1');

    expect(relation.add).toHaveBeenCalledWith({ values: ['shipment-1'] });
    expect(relation.remove).toHaveBeenCalledWith({ values: ['shipment-1'] });
    expect(relation.destroy).not.toHaveBeenCalled();
  });

  it('loads stable history field names for localized rendering', async () => {
    const { service, api } = setup();
    const history = api.resource('transport_run_history') as unknown as ResourceStub;
    history.list.mockResolvedValue({
      data: {
        data: [
          {
            id: 'history-1',
            event_type: 'field_changed',
            field_name: 'departure_city',
            field_label: 'Город отправления',
            old_value: 'Хуньчунь',
            new_value: 'Суйфэньхэ',
            createdAt: '2026-09-15T00:00:00.000Z',
            createdBy: { nickname: 'Менеджер' },
          },
        ],
      },
    });

    await expect(service.getRunHistory('run-1')).resolves.toMatchObject([
      {
        id: 'history-1',
        eventType: 'field_changed',
        fieldName: 'departure_city',
        oldValue: 'Хуньчунь',
        newValue: 'Суйфэньхэ',
        createdBy: 'Менеджер',
      },
    ]);
    expect(history.list).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { transport_run_id: 'run-1' },
        fields: expect.arrayContaining(['field_name']),
      }),
    );
  });

  it('requests reference data using only columns present in each collection', async () => {
    const { service, resources } = setup();

    await service.getReferenceData();

    for (const resource of ['chinese_clients', 'our_companies', 'customs_warehouses', 'departure_cities']) {
      expect(resources.get(resource)?.list).toHaveBeenCalledWith(
        expect.objectContaining({ sort: ['name', 'id'], fields: ['id', 'name'] }),
      );
    }
    expect(resources.get('contracts')?.list).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: ['name', 'id'],
        fields: ['id', 'name'],
        appends: ['importers'],
      }),
    );
    expect(resources.get('users')?.list).toHaveBeenCalledWith(
      expect.objectContaining({ sort: ['nickname', 'id'], fields: ['id', 'nickname', 'username'] }),
    );
  });

  it('loads the companies linked to each contract', async () => {
    const { service, api } = setup();
    const contracts = api.resource('contracts') as unknown as ResourceStub;
    contracts.list.mockResolvedValue({
      data: {
        data: [
          {
            id: 'contract-1',
            name: 'N-SFT-0726',
            importers: [{ id: 'company-1' }, { id: 'company-2' }],
          },
        ],
      },
    });

    await expect(service.getReferenceData()).resolves.toMatchObject({
      contracts: [
        {
          id: 'contract-1',
          label: 'N-SFT-0726',
          companyIds: ['company-1', 'company-2'],
        },
      ],
    });
  });
});
