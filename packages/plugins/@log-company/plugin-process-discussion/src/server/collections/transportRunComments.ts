/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'transport_run_comments',
  title: 'Сообщения к рейсам',
  hidden: true,
  autoGenId: true,
  createdAt: true,
  createdBy: true,
  updatedAt: false,
  filterTargetKey: ['id'],
  migrationRules: ['overwrite', 'schema-only'],
  indexes: [{ name: 'transport_run_comments_run_created_idx', fields: ['transport_run_id', 'createdAt'] }],
  fields: [
    { type: 'bigInt', name: 'transport_run_id', isForeignKey: true, allowNull: false },
    {
      type: 'belongsTo',
      name: 'run',
      target: 'transport_runs',
      targetKey: 'id',
      foreignKey: 'transport_run_id',
      onDelete: 'CASCADE',
    },
    { type: 'text', name: 'text', allowNull: false },
    {
      type: 'belongsToMany',
      name: 'attachment',
      interface: 'attachment',
      target: 'attachments',
      targetKey: 'id',
      sourceKey: 'id',
      through: 'transport_run_comment_attachments',
      foreignKey: 'transport_run_comment_id',
      otherKey: 'attachment_id',
      onDelete: 'CASCADE',
    },
  ],
});
