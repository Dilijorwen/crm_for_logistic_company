/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import RestrictShipmentStatusAccess from '../20260929091000-restrict-shipment-status-access';

type MigrationContext = ConstructorParameters<typeof RestrictShipmentStatusAccess>[0];

describe('restrict shipment status access migration', () => {
  it('removes automatically expanded edit rights and preserves intended status access', async () => {
    const query = vi.fn(async () => undefined);
    const migration = new RestrictShipmentStatusAccess({
      db: { sequelize: { query } },
    } as unknown as MigrationContext);

    await migration.up();

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain('shipment_resource."roleName" = \'manager\'');
    expect(query.mock.calls[0][0]).toContain('shipment_resource."roleName" = \'financier\'');
    expect(query.mock.calls[1][0]).toContain('shipment_resource."roleName" = \'declarant\'');
  });
});
