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
import { FILTER_TEMPLATES_COLLECTION } from '../infrastructure/NocoBaseFilterTemplateRepository';

const REFERENCES = [
  { field: 'userId', target: 'users', targetField: 'id', name: 'lc_filter_templates_user_fk' },
  { field: 'tableUid', target: 'flowModels', targetField: 'uid', name: 'lc_filter_templates_table_fk' },
  { field: 'instanceRootUid', target: 'flowModels', targetField: 'uid', name: 'lc_filter_templates_root_fk' },
];

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const collection = this.db.getCollection(FILTER_TEMPLATES_COLLECTION);
    if (!collection) throw new Error('Filter template metadata is not loaded.');
    // The collection owns table/index creation; the migration adds physical references after sync.
    await collection.sync({ alter: { drop: false } });
    const queryInterface = this.db.sequelize.getQueryInterface();
    const table = collection.model.getTableName();
    const references = await queryInterface.getForeignKeyReferencesForTable(table);
    for (const reference of REFERENCES) {
      if (
        Array.isArray(references) &&
        references.some((existing) => record(existing).constraintName === reference.name)
      )
        continue;
      const target = this.db.getCollection(reference.target);
      if (!target) throw new Error(`Required collection ${reference.target} is not loaded.`);
      await queryInterface.addConstraint(table, {
        fields: [collection.getField(reference.field).columnName()],
        type: 'foreign key',
        name: reference.name,
        references: { table: target.model.getTableName(), field: target.getField(reference.targetField).columnName() },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      });
    }
  }

  async down(): Promise<void> {
    const collection = this.db.getCollection(FILTER_TEMPLATES_COLLECTION);
    if (!collection) return;
    const queryInterface = this.db.sequelize.getQueryInterface();
    const table = collection.model.getTableName();
    const references = await queryInterface.getForeignKeyReferencesForTable(table);
    for (const reference of REFERENCES) {
      if (
        Array.isArray(references) &&
        references.some((existing) => record(existing).constraintName === reference.name)
      ) {
        await queryInterface.removeConstraint(table, reference.name);
      }
    }
  }
}
