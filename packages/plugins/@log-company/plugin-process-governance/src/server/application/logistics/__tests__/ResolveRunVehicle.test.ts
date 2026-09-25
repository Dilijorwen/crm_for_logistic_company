/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import type { LogisticsRepository } from '../ports/LogisticsRepository';
import { ResolveRunVehicle } from '../ResolveRunVehicle';

describe('ResolveRunVehicle', () => {
  it('normalizes a number and delegates idempotent lookup to the repository', async () => {
    const repository = {
      findOrCreateVehicle: vi.fn(async () => 'vehicle-1'),
    } as unknown as LogisticsRepository;
    const action = new ResolveRunVehicle(repository);

    await expect(action.execute({ registrationNumber: ' а/123-вс ' })).resolves.toEqual({
      vehicleId: 'vehicle-1',
      registrationNumber: 'A/123-BC',
    });
    expect(repository.findOrCreateVehicle).toHaveBeenCalledWith('A/123-BC', undefined);
  });

  it('rejects a registration number outside the supported international format', async () => {
    const repository = {
      findOrCreateVehicle: vi.fn(async () => 'vehicle-1'),
    } as unknown as LogisticsRepository;
    const action = new ResolveRunVehicle(repository);

    await expect(action.execute({ registrationNumber: '京A12345' })).rejects.toMatchObject({
      code: 'INVALID_REGISTRATION_NUMBER',
    });
    expect(repository.findOrCreateVehicle).not.toHaveBeenCalled();
  });
});
