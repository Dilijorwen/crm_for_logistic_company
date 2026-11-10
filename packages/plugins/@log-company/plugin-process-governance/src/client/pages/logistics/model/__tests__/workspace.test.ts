/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { buildLogisticsWorkItems, EMPTY_LOGISTICS_WORKSPACE_FILTERS, filterLogisticsWorkItems } from '../workspace';
import type { ShipmentRecord, TransportRunRecord } from '../types';

function shipment(overrides: Partial<ShipmentRecord> = {}): ShipmentRecord {
  return {
    id: 'shipment-1',
    shipmentNumber: 450,
    displayName: 'Поставка 450',
    status: 'clearance',
    chineseClient: { id: 'client-1', label: 'Wang Export' },
    company: { id: 'company-1', label: 'Логистика' },
    invoiceNumber: '',
    invoiceValue: null,
    contract: null,
    customsScheme: '',
    customsWarehouse: null,
    customsWarehouseStorageDate: null,
    declarationNumber: '10701000',
    applicationNumber: '',
    documentsInBadis: false,
    customsPaymentsAmount: null,
    ecoFee: null,
    ktcAmount: null,
    ntmCertificateGoods: '',
    ntmSkkGoods: '',
    ntmKfkGoods: '',
    ntmHonestSignGoods: '',
    ntmExportDeclarationRequired: false,
    ntmHonestSignSum: null,
    goodsCount: null,
    enteredIn1c: false,
    sentToClient: false,
    additionalCheckResponseDeadline: null,
    additionalCheckResponseDeadline60Days: null,
    actualControl: false,
    anosovDistributed: false,
    managerComment: '',
    ...overrides,
  };
}

function run(overrides: Partial<TransportRunRecord> = {}): TransportRunRecord {
  return {
    id: 'run-1',
    runNumber: 125,
    createdAt: '',
    registrationNumber: 'А123ВС',
    departureCity: null,
    managers: [{ id: 'manager-1', label: 'Иванов' }],
    declarants: [{ id: 'declarant-1', label: 'Петров' }],
    parentRuns: [],
    shipments: [shipment()],
    ...overrides,
  };
}

describe('logistics workspace', () => {
  it('creates one work item for every shipment-to-run link and retains empty runs', () => {
    const items = buildLogisticsWorkItems([
      run({ shipments: [shipment({ id: 'shipment-1' }), shipment({ id: 'shipment-2' })] }),
      run({ id: 'run-2', shipments: [] }),
    ]);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'run-1:shipment-1' }),
        expect.objectContaining({ id: 'run-1:shipment-2' }),
        expect.objectContaining({ id: 'run-2:unlinked', shipment: null }),
      ]),
    );
  });

  it('filters across run and shipment fields without hiding records by default', () => {
    const items = buildLogisticsWorkItems([run()]);

    expect(filterLogisticsWorkItems(items, EMPTY_LOGISTICS_WORKSPACE_FILTERS)).toHaveLength(1);
    expect(filterLogisticsWorkItems(items, { ...EMPTY_LOGISTICS_WORKSPACE_FILTERS, search: 'wang' })).toHaveLength(1);
    expect(filterLogisticsWorkItems(items, { ...EMPTY_LOGISTICS_WORKSPACE_FILTERS, search: 'а123вс' })).toHaveLength(1);
    expect(filterLogisticsWorkItems(items, { ...EMPTY_LOGISTICS_WORKSPACE_FILTERS, status: 'warehouse' })).toHaveLength(
      0,
    );
  });

  it('filters by the assigned manager and declarant', () => {
    const items = buildLogisticsWorkItems([run()]);

    expect(
      filterLogisticsWorkItems(items, { ...EMPTY_LOGISTICS_WORKSPACE_FILTERS, managerId: 'manager-1' }),
    ).toHaveLength(1);
    expect(
      filterLogisticsWorkItems(items, { ...EMPTY_LOGISTICS_WORKSPACE_FILTERS, declarantId: 'declarant-2' }),
    ).toHaveLength(0);
  });
});
