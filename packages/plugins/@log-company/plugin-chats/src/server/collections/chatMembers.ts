/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { defineCollection, Op } from '@nocobase/database';

export default defineCollection({
  name: 'chat_members',
  title: '{{t("Chat members", { ns: "@log-company/plugin-chats" })}}',
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
    {
      name: 'chat_members_active_user_unique',
      unique: true,
      fields: ['chat_id', 'user_id'],
      where: { left_at: null, user_id: { [Op.ne]: null } },
    },
    { name: 'chat_members_user_left_idx', fields: ['user_id', 'left_at'] },
    { name: 'chat_members_chat_idx', fields: ['chat_id', 'joined_at', 'id'] },
  ],
  fields: [
    { type: 'snowflakeId', name: 'id', interface: 'snowflakeId', primaryKey: true, allowNull: false },
    { type: 'bigInt', name: 'chat_id', interface: 'integer', isForeignKey: true, allowNull: false },
    { type: 'bigInt', name: 'user_id', interface: 'integer', isForeignKey: true },
    { type: 'string', name: 'member_name', interface: 'input', allowNull: false },
    { type: 'string', name: 'role', interface: 'select', allowNull: false },
    { type: 'date', name: 'joined_at', interface: 'datetime', allowNull: false },
    { type: 'date', name: 'left_at', interface: 'datetime' },
    { type: 'date', name: 'last_read_at', interface: 'datetime' },
    { type: 'boolean', name: 'is_muted', interface: 'checkbox', allowNull: false, defaultValue: false },
  ],
});
