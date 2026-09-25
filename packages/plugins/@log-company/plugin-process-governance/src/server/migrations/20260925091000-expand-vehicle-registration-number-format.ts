/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';

const VEHICLE_REGISTRATION_NUMBER_CONSTRAINT = 'vehicles_registration_number_format_check';

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await this.db.sequelize.query(
      `ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS ${VEHICLE_REGISTRATION_NUMBER_CONSTRAINT}`,
    );
    await this.db.sequelize.query(
      `ALTER TABLE vehicles ADD CONSTRAINT ${VEHICLE_REGISTRATION_NUMBER_CONSTRAINT} ` +
        `CHECK (registration_number ~ '^[!-~]{2,32}$')`,
    );
  }

  async down(): Promise<void> {
    // Keep the expanded constraint because valid numbers with special characters may already exist.
  }
}
