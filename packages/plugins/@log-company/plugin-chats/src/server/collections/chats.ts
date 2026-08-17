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
  name: 'chats',
  title: '{{t("Chats", { ns: "@log-company/plugin-chats" })}}',
  template: 'general',
  autoGenId: false,
  createdAt: false,
  updatedAt: false,
  createdBy: false,
  updatedBy: false,
  logging: true,
  filterTargetKey: ['id'],
  migrationRules: ['overwrite', 'schema-only'],
  indexes: [
    { name: 'chats_direct_key_unique', unique: true, fields: ['direct_key'] },
    { name: 'chats_last_message_at_idx', fields: [{ name: 'last_message_at', order: 'DESC' }] },
  ],
  fields: [
    { type: 'snowflakeId', name: 'id', interface: 'snowflakeId', primaryKey: true, allowNull: false },
    { type: 'string', name: 'type', interface: 'select', allowNull: false },
    { type: 'string', name: 'title', interface: 'input' },
    { type: 'string', name: 'direct_key', interface: 'input', unique: true },
    { type: 'bigInt', name: 'created_by_id', interface: 'integer', isForeignKey: true },
    { type: 'date', name: 'created_at', interface: 'datetime', allowNull: false },
    { type: 'date', name: 'updated_at', interface: 'datetime', allowNull: false },
    { type: 'date', name: 'last_message_at', interface: 'datetime' },
    { type: 'date', name: 'deleted_at', interface: 'datetime' },
  ],
});
