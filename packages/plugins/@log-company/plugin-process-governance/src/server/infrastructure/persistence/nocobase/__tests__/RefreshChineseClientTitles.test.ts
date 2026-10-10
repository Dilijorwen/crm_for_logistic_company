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
import { NocoBaseProcessGovernanceRepository } from '../NocoBaseProcessGovernanceRepository';

describe('legacy Chinese client titles', () => {
  it('allows renaming clients when the legacy process table no longer exists', async () => {
    const query = vi.fn().mockResolvedValue([[{ name: null }], {}]);
    const repository = new NocoBaseProcessGovernanceRepository({ db: { sequelize: { query } } } as unknown as Plugin);
    await expect(repository.refreshTitlesForChineseClient('1', 'Новое имя')).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('still updates legacy process titles when the table is present', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([[{ name: 'customs_processes' }], {}])
      .mockResolvedValueOnce([[], {}]);
    const repository = new NocoBaseProcessGovernanceRepository({ db: { sequelize: { query } } } as unknown as Plugin);
    await repository.refreshTitlesForChineseClient('1', 'Новое имя');
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][1].replacements).toEqual({ clientId: '1', clientName: 'Новое имя' });
  });
});
