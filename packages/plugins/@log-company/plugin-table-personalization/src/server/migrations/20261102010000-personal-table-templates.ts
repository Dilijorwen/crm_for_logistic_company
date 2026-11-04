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
import { FILTER_TEMPLATES_COLLECTION } from '../infrastructure/NocoBaseFilterTemplateRepository';
import { record } from '../../shared/contracts';

export default class extends Migration {
  on = 'beforeLoad';

  async up(): Promise<void> {
    const query = this.db.sequelize.getQueryInterface();
    const table = this.db.getCollection(FILTER_TEMPLATES_COLLECTION)?.model.getTableName() || {
      tableName: `${this.db.getTablePrefix()}${FILTER_TEMPLATES_COLLECTION}`,
      schema: this.db.options.schema || 'public',
    };
    if (!(await query.tableExists(table))) return;
    const columns = await query.describeTable(table);
    await this.db.sequelize.transaction(async (transaction) => {
      if (!columns.columnSettings) {
        await query.addColumn(table, 'columnSettings', { type: DataTypes.JSON, allowNull: true }, { transaction });
      }
      // The user explicitly allowed removing the old filter-only templates. Preserve all new snapshots on retries.
      await query.bulkDelete(table, { columnSettings: null }, { transaction });
      const indexes = await query.showIndex(table, { transaction });
      const hasNameIndex =
        Array.isArray(indexes) && indexes.some((index) => record(index).name === 'lc_filter_templates_name');
      const isLegacy = Boolean(columns.scopeKey || columns.visibility);
      if (hasNameIndex && isLegacy) await query.removeIndex(table, 'lc_filter_templates_name', { transaction });
      for (const name of ['scopeKey', 'visibility']) {
        if (columns[name]) await query.removeColumn(table, name, { transaction });
      }
      await query.changeColumn(table, 'columnSettings', { type: DataTypes.JSON, allowNull: false }, { transaction });
      if (!hasNameIndex || isLegacy) {
        await query.addIndex(table, ['instanceKey', 'userId', 'name'], {
          name: 'lc_filter_templates_name',
          unique: true,
          transaction,
        });
      }
    });
  }
}
