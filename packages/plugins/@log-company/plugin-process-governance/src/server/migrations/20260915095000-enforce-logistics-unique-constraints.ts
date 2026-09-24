/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';

const UNIQUE_CONSTRAINTS = [
  { table: 'vehicles', field: 'registration_number', name: 'vehicles_registration_number_unique' },
  { table: 'transport_runs', field: 'run_number', name: 'transport_runs_run_number_unique' },
  { table: 'shipments', field: 'shipment_number', name: 'shipments_shipment_number_unique' },
] as const;

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    for (const definition of UNIQUE_CONSTRAINTS) {
      if (await this.constraintExists(definition.name)) {
        continue;
      }
      await this.db.sequelize.query(`DROP INDEX IF EXISTS ${definition.name}`);
      await this.db.sequelize.getQueryInterface().addConstraint(definition.table, {
        fields: [definition.field],
        type: 'unique',
        name: definition.name,
      });
    }
  }

  async down(): Promise<void> {
    // Unique constraints are intentionally preserved with user data.
  }

  private async constraintExists(name: string): Promise<boolean> {
    const [rows] = (await this.db.sequelize.query(
      'SELECT 1 FROM pg_constraint WHERE connamespace = current_schema()::regnamespace AND conname = :name LIMIT 1',
      { replacements: { name } },
    )) as [unknown[], unknown];
    return rows.length > 0;
  }
}
