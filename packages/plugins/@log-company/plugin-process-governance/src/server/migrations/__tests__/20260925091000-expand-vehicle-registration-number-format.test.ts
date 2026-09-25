/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import ExpandVehicleRegistrationNumberFormat from '../20260925091000-expand-vehicle-registration-number-format';

type MigrationContext = ConstructorParameters<typeof ExpandVehicleRegistrationNumberFormat>[0];

describe('ExpandVehicleRegistrationNumberFormat migration', () => {
  it('replaces the old vehicle number constraint with a printable non-space ASCII constraint', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new ExpandVehicleRegistrationNumberFormat({
      db: { sequelize: { query } },
    } as unknown as MigrationContext);

    await migration.up();

    expect(query).toHaveBeenNthCalledWith(
      1,
      'ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_registration_number_format_check',
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      'ALTER TABLE vehicles ADD CONSTRAINT vehicles_registration_number_format_check ' +
        "CHECK (registration_number ~ '^[!-~]{2,32}$')",
    );
  });
});
