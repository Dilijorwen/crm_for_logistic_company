/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { RefreshPermitDocumentLifecycle } from '../RefreshPermitDocumentLifecycle';

describe('local permit document lifecycle', () => {
  it('expires rentals separately from registry statuses and terminates voluntary documents after the final local day', async () => {
    const repository = {
      listLocalPeriods: vi.fn().mockResolvedValue([
        { id: '1', category: 'rented', until: '2026-10-22' },
        { id: '2', category: 'voluntary', until: '2026-10-22' },
        { id: '3', category: 'voluntary', until: '2026-10-23' },
      ]),
      applyLocalState: vi.fn(),
    };
    await new RefreshPermitDocumentLifecycle(repository, { now: () => new Date('2026-10-22T14:00:00Z') }).execute();
    expect(repository.applyLocalState.mock.calls).toEqual([
      ['1', 'rented', '2026-10-22', 'expired'],
      ['2', 'voluntary', '2026-10-22', 'terminated'],
      ['3', 'voluntary', '2026-10-23', 'valid'],
    ]);
  });
});
