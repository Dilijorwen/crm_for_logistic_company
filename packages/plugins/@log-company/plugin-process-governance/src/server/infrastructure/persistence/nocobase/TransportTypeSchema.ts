/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DataTypes, type Database } from '@nocobase/database';

/** Called only by migrations, before source collections with required fields are loaded. */
export async function ensureTransportTypeSchema(db: Database): Promise<void> {
  const query = db.sequelize.getQueryInterface();
  const tables = await query.showAllTables();
  if (!tables.includes('transport_runs')) return;
  const columns = await query.describeTable('transport_runs');
  await db.sequelize.transaction(async (transaction) => {
    if (!columns.transport_type)
      await query.addColumn(
        'transport_runs',
        'transport_type',
        { type: DataTypes.STRING, allowNull: true },
        { transaction },
      );
    await db.sequelize.query("UPDATE transport_runs SET transport_type = 'road' WHERE transport_type IS NULL", {
      transaction,
    });
    if (!columns.transport_type || columns.transport_type.allowNull)
      await query.changeColumn(
        'transport_runs',
        'transport_type',
        { type: DataTypes.STRING, allowNull: false },
        { transaction },
      );
    await db.sequelize.query(
      "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transport_runs_transport_type_check') THEN ALTER TABLE transport_runs ADD CONSTRAINT transport_runs_transport_type_check CHECK (transport_type IN ('road','rail','air','sea')); END IF; END $$",
      { transaction },
    );
    await db.sequelize.query(
      'CREATE INDEX IF NOT EXISTS transport_runs_type_number_idx ON transport_runs (transport_type, run_number)',
      { transaction },
    );
  });
}
