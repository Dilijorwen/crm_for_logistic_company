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
import { documentSectionRulesCollection } from '../collections/processDocumentSectionRules';

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const query = this.db.sequelize.getQueryInterface();
    const existing = await Promise.all(
      ['process_documents', 'process_document_folders'].map(
        async (table) => [table, await query.describeTable(table)] as const,
      ),
    );
    await this.db.sequelize.transaction(async (transaction) => {
      for (const [table, fields] of existing) {
        if (!fields.company_area) {
          await query.addColumn(table, 'company_area', { type: DataTypes.STRING, allowNull: true }, { transaction });
        }
      }
      if (!(await query.tableExists(documentSectionRulesCollection, { transaction }))) {
        await query.createTable(
          documentSectionRulesCollection,
          {
            id: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
            rules: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
          },
          { transaction },
        );
      }
    });
  }
}
