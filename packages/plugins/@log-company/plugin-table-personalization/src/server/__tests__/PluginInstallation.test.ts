/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { PluginTablePersonalizationServer } from '../plugin';

describe('first plugin installation', () => {
  it('runs the discovered afterLoad migrations after collection synchronization', async () => {
    const migrations = [{ name: 'personalization-cascades' }];
    const up = vi.fn().mockResolvedValue(undefined);
    const createMigrator = vi.fn().mockReturnValue({ up });
    const loadMigrations = vi.fn().mockResolvedValue({ afterLoad: migrations });
    const plugin = { db: { createMigrator }, loadMigrations } as unknown as PluginTablePersonalizationServer;
    await PluginTablePersonalizationServer.prototype.install.call(plugin);
    expect(createMigrator).toHaveBeenCalledWith({ migrations });
    expect(up).toHaveBeenCalledOnce();
  });
});
