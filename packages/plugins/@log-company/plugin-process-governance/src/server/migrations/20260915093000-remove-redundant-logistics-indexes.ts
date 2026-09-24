/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';

const REDUNDANT_INDEXES = [
  'vehicles_registration_number_key',
  'transport_runs_run_number_key',
  'transport_runs_run_number_key1',
  'shipments_shipment_number_key',
  'shipments_shipment_number_key1',
] as const;

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    for (const indexName of REDUNDANT_INDEXES) {
      await this.db.sequelize.query(`DROP INDEX IF EXISTS ${indexName}`);
    }
  }

  async down(): Promise<void> {
    // The explicitly named unique indexes remain and continue to enforce uniqueness.
  }
}
