/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DataTypes } from '@nocobase/database';
import { Migration } from '@nocobase/server';

const tables = ['process_documents', 'process_document_folders'] as const;
const owners = { company_id: 'our_companies', transport_run_id: 'transport_runs' } as const;

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const query = this.db.sequelize.getQueryInterface();
    await this.db.sequelize.transaction(async (transaction) => {
      for (const table of tables) {
        const columns = await query.describeTable(table);
        for (const [column, owner] of Object.entries(owners)) {
          if (!columns[column]) {
            await query.addColumn(
              table,
              column,
              {
                type: DataTypes.BIGINT,
              },
              { transaction },
            );
          }
          const name = `${table}_${column}_fk`;
          const [constraints] = await this.db.sequelize.query(
            `select 1 from pg_constraint where conrelid = cast(:table as regclass) and conname = :name`,
            { replacements: { table, name }, transaction },
          );
          if (!constraints.length) {
            await query.addConstraint(table, {
              name,
              type: 'foreign key',
              fields: [column],
              references: { table: owner, field: 'id' },
              onDelete: 'RESTRICT',
              onUpdate: 'NO ACTION',
              transaction,
            });
          }
          await this.db.sequelize.query(
            `insert into fields (key, name, type, "collectionName", options)
             values (:key, :column, 'bigInt', :table, '{"hidden":true}')
             on conflict ("collectionName", name) do nothing`,
            { replacements: { key: `${table}_${column}`, column, table }, transaction },
          );
        }
        if (table === 'process_document_folders') {
          if (!columns.access_grants) {
            await query.addColumn(table, 'access_grants', { type: DataTypes.JSONB }, { transaction });
          }
          await this.db.sequelize.query(
            `insert into fields (key, name, type, "collectionName", options)
             values ('process_document_folders_access_grants', 'access_grants', 'jsonb', :table, '{"hidden":true}')
             on conflict ("collectionName", name) do nothing`,
            { replacements: { table }, transaction },
          );
        }
        const parent = table === 'process_documents' ? 'folder_id' : 'parent_folder_id';
        await this.db.sequelize.query(
          `
          create index if not exists ${table}_company_run_folder_idx
            on ${table} (company_id, transport_run_id, ${parent});
          alter table ${table} drop constraint if exists ${table}_company_owner_check;
          alter table ${table} add constraint ${table}_company_owner_check
            check ((transport_run_id is null or company_id is not null)
              and (company_id is null or (shipment_id is null and draft_token is null)));
        `,
          { transaction },
        );
      }
    });
  }
}
