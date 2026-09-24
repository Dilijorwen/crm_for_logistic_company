/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { RefreshShipmentDisplayName } from '../RefreshShipmentDisplayName';
import type { LogisticsRepository } from '../ports/LogisticsRepository';

describe('RefreshShipmentDisplayName', () => {
  it('persists a title built from the current shipment and client values', async () => {
    const repository = {
      getShipmentDisplayNameParts: vi.fn(async () => ({
        shipmentNumber: 7,
        clientName: 'Клиент',
        invoiceNumber: null,
        applicationNumber: 'ZV-1',
        declarationNumber: null,
      })),
      updateShipmentDisplayName: vi.fn(async () => undefined),
    } as unknown as LogisticsRepository;
    const useCase = new RefreshShipmentDisplayName(repository);

    await expect(useCase.execute('shipment-1')).resolves.toBe('7/Клиент/—/ZV-1/—');
    expect(repository.updateShipmentDisplayName).toHaveBeenCalledWith('shipment-1', '7/Клиент/—/ZV-1/—', undefined);
  });

  it('does not write a title for a missing shipment', async () => {
    const repository = {
      getShipmentDisplayNameParts: vi.fn(async () => null),
      updateShipmentDisplayName: vi.fn(async () => undefined),
    } as unknown as LogisticsRepository;
    const useCase = new RefreshShipmentDisplayName(repository);

    await expect(useCase.execute('missing')).resolves.toBeNull();
    expect(repository.updateShipmentDisplayName).not.toHaveBeenCalled();
  });
});
