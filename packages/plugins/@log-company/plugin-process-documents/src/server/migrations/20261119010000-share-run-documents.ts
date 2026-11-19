/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';

const runDocumentTables = [
  { table: 'process_documents', folder: 'folder_id' },
  { table: 'process_document_folders', folder: 'parent_folder_id' },
] as const;

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await this.db.sequelize.transaction(async (transaction) => {
      for (const { table, folder } of runDocumentTables) {
        await this.db.sequelize.query(
          `
          alter table ${table} drop constraint if exists ${table}_company_owner_check;

          update ${table}
          set company_id = null
          where transport_run_id is not null and company_id is not null;

          alter table ${table} add constraint ${table}_company_owner_check
            check ((transport_run_id is null or company_id is null)
              and ((company_id is null and transport_run_id is null)
                or (shipment_id is null and draft_token is null)));

          create index if not exists ${table}_run_folder_idx
            on ${table} (transport_run_id, ${folder}) where transport_run_id is not null;
          `,
          { transaction },
        );
      }
    });
  }
}
