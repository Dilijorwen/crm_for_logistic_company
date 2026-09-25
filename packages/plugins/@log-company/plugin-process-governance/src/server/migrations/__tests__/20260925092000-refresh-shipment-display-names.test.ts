/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import RefreshShipmentDisplayNames from '../20260925092000-refresh-shipment-display-names';

type MigrationContext = ConstructorParameters<typeof RefreshShipmentDisplayNames>[0];

describe('RefreshShipmentDisplayNames migration', () => {
  it('rebuilds all titles with separate application and declaration number parts', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new RefreshShipmentDisplayNames({
      db: { sequelize: { query } },
    } as unknown as MigrationContext);

    await migration.up();

    expect(query).toHaveBeenCalledOnce();
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain('set display_name = concat');
    expect(sql.indexOf('s.application_number')).toBeLessThan(sql.indexOf('s.declaration_number'));
    expect(sql).toContain("btrim(s.application_number), ''), '—'), '/'");
  });
});
