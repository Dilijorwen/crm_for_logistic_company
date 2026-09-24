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
import { LogisticsIntegrityGuard } from '../LogisticsIntegrityGuard';

describe('LogisticsIntegrityGuard', () => {
  it('restores all required unique indexes after NocoBase startup synchronization', async () => {
    let afterStart: (() => Promise<void>) | undefined;
    const query = vi.fn(async (_sql: string) => undefined);
    const plugin = {
      app: {
        on: (event: string, handler: () => Promise<void>) => {
          if (event === 'afterStart') {
            afterStart = handler;
          }
        },
      },
      db: { sequelize: { getDialect: () => 'postgres', query } },
    } as unknown as Plugin;

    new LogisticsIntegrityGuard(plugin).register();
    await afterStart?.();

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls.map(([sql]) => sql)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('vehicles_registration_number_unique'),
        expect.stringContaining('transport_runs_run_number_unique'),
        expect.stringContaining('shipments_shipment_number_unique'),
      ]),
    );
  });
});
