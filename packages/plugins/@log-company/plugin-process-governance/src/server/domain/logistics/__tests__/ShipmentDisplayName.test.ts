/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { buildShipmentDisplayName } from '../ShipmentDisplayName';

describe('buildShipmentDisplayName', () => {
  it('builds the stable global shipment title', () => {
    expect(
      buildShipmentDisplayName({
        shipmentNumber: 35,
        clientName: 'ООО Ромашка',
        invoiceNumber: 'INV-77',
        applicationNumber: '10108010/190926/000001',
        declarationNumber: '10702030/190926/000002',
      }),
    ).toBe('35/ООО Ромашка/INV-77/10108010/190926/000001/10702030/190926/000002');
  });

  it('uses an em dash for every missing component', () => {
    expect(
      buildShipmentDisplayName({
        shipmentNumber: 35,
        clientName: '  ',
        invoiceNumber: null,
        applicationNumber: undefined,
        declarationNumber: '',
      }),
    ).toBe('35/—/—/—/—');
  });
});
