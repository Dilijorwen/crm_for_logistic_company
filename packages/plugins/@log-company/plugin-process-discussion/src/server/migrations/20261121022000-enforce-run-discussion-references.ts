/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';

const foreignKeys = [
  ['transport_run_comments', 'transport_run_id', 'transport_runs', 'transport_run_comments_run_fk'],
  [
    'transport_run_comment_attachments',
    'transport_run_comment_id',
    'transport_run_comments',
    'run_comment_attachments_comment_fk',
  ],
  ['transport_run_comment_attachments', 'attachment_id', 'attachments', 'run_comment_attachments_attachment_fk'],
] as const;

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    if (this.db.sequelize.getDialect() !== 'postgres') return;
    await this.db.sequelize.transaction(async (transaction) => {
      const queryInterface = this.db.sequelize.getQueryInterface();
      for (const [table, column, target, name] of foreignKeys) {
        const [constraints] = await this.db.sequelize.query(
          'SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass(:table) AND conname = :name',
          { replacements: { table, name }, transaction },
        );
        if (constraints.length) continue;
        await queryInterface.addConstraint(table, {
          fields: [column],
          type: 'foreign key',
          name,
          references: { table: target, field: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction,
        });
      }
    });
  }
}
