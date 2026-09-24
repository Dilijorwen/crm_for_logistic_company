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
import { WriteLogisticsHistory } from '../WriteLogisticsHistory';

function historyEntry() {
  return {
    entityKind: 'run' as const,
    entityId: '10',
    eventType: 'created' as const,
    fieldLabel: 'Создан рейс',
  };
}

describe('WriteLogisticsHistory', () => {
  it('skips history only while its collection is unavailable during bootstrap', async () => {
    const repository = {
      historyCollectionExists: vi.fn(() => false),
      createHistory: vi.fn(),
    } as unknown as LogisticsRepository;
    const logger = { warn: vi.fn(), error: vi.fn() };

    await new WriteLogisticsHistory(repository, logger).execute({ entry: historyEntry() });

    expect(repository.createHistory).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('propagates a persistence failure so the surrounding business transaction can roll back', async () => {
    const failure = new Error('history write failed');
    const repository = {
      historyCollectionExists: vi.fn(() => true),
      createHistory: vi.fn(async () => {
        throw failure;
      }),
    } as unknown as LogisticsRepository;
    const logger = { warn: vi.fn(), error: vi.fn() };

    await expect(new WriteLogisticsHistory(repository, logger).execute({ entry: historyEntry() })).rejects.toBe(
      failure,
    );
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
