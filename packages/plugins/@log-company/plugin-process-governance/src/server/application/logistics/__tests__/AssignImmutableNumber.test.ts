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
import { AssignImmutableNumber } from '../AssignImmutableNumber';

describe('AssignImmutableNumber', () => {
  it('assigns the next number to a new run', async () => {
    const repository = { nextNumber: vi.fn(async () => 17) } as unknown as LogisticsRepository;
    const action = new AssignImmutableNumber(repository);

    await expect(
      action.execute({ entityKind: 'run', isNewRecord: true, previousNumber: undefined, currentNumber: undefined }),
    ).resolves.toBe(17);
    expect(repository.nextNumber).toHaveBeenCalledWith('run', undefined);
  });

  it('keeps the original number when an update tries to replace it', async () => {
    const repository = { nextNumber: vi.fn(async () => 18) } as unknown as LogisticsRepository;
    const action = new AssignImmutableNumber(repository);

    await expect(
      action.execute({ entityKind: 'shipment', isNewRecord: false, previousNumber: 7, currentNumber: 99 }),
    ).resolves.toBe(7);
    expect(repository.nextNumber).not.toHaveBeenCalled();
  });
});
