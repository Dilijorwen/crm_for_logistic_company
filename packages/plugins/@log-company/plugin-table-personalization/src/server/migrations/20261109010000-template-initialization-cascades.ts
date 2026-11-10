/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import { record } from '../../shared/contracts';
import { TEMPLATE_INITIALIZATIONS_COLLECTION } from '../infrastructure/NocoBaseFilterTemplateRepository';

const REFERENCES = [
  { field: 'userId', target: 'users', targetField: 'id', name: 'lc_template_initializations_user_fk' },
  { field: 'tableUid', target: 'flowModels', targetField: 'uid', name: 'lc_template_initializations_table_fk' },
  { field: 'instanceRootUid', target: 'flowModels', targetField: 'uid', name: 'lc_template_initializations_root_fk' },
];

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const collection = this.db.getCollection(TEMPLATE_INITIALIZATIONS_COLLECTION);
    if (!collection) throw new Error('Template initialization collection is not loaded.');
    await collection.sync({ alter: { drop: false } });
    const query = this.db.sequelize.getQueryInterface();
    const table = collection.model.getTableName();
    const references = await query.getForeignKeyReferencesForTable(table);
    for (const reference of REFERENCES) {
      if (
        Array.isArray(references) &&
        references.some((existing) => record(existing).constraintName === reference.name)
      ) {
        continue;
      }
      const target = this.db.getCollection(reference.target);
      if (!target) throw new Error(`Required collection ${reference.target} is not loaded.`);
      await query.addConstraint(table, {
        name: reference.name,
        type: 'foreign key',
        fields: [collection.getField(reference.field).columnName()],
        references: { table: target.model.getTableName(), field: target.getField(reference.targetField).columnName() },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      });
    }
  }
}
