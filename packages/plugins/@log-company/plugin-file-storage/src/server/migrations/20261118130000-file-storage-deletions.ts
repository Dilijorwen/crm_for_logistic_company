/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import { DataTypes } from '@nocobase/database';

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const query = this.db.sequelize.getQueryInterface();
    await this.db.sequelize.transaction(async (transaction) => {
      await query.createTable(
        'log_company_file_deletions',
        {
          id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
          application: { type: DataTypes.STRING(128), allowNull: false },
          area: { type: DataTypes.STRING(32), allowNull: false },
          object_key: { type: DataTypes.TEXT, allowNull: false },
          current_only: { type: DataTypes.BOOLEAN, allowNull: false },
          retry_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: this.db.sequelize.literal('CURRENT_TIMESTAMP'),
          },
        },
        { transaction },
      );
      await query.addIndex('log_company_file_deletions', ['application', 'retry_at', 'id'], {
        name: 'log_company_file_deletions_retry_idx',
        transaction,
      });
    });
  }
}
