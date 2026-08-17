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
  name: 'chat_messages',
  title: '{{t("Chat messages", { ns: "@log-company/plugin-chats" })}}',
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
      name: 'chat_messages_chat_created_idx',
      fields: ['chat_id', { name: 'created_at', order: 'DESC' }, { name: 'id', order: 'DESC' }],
    },
  ],
  fields: [
    { type: 'snowflakeId', name: 'id', interface: 'snowflakeId', primaryKey: true, allowNull: false },
    { type: 'bigInt', name: 'chat_id', interface: 'integer', isForeignKey: true, allowNull: false },
    { type: 'bigInt', name: 'author_id', interface: 'integer', isForeignKey: true },
    { type: 'string', name: 'author_name', interface: 'input', allowNull: false },
    { type: 'text', name: 'text', interface: 'textarea' },
    { type: 'string', name: 'message_type', interface: 'select', allowNull: false },
    { type: 'bigInt', name: 'reply_to_message_id', interface: 'integer', isForeignKey: true },
    { type: 'date', name: 'created_at', interface: 'datetime', allowNull: false },
    { type: 'date', name: 'deleted_at', interface: 'datetime' },
    { type: 'bigInt', name: 'deleted_by_id', interface: 'integer', isForeignKey: true },
  ],
});
