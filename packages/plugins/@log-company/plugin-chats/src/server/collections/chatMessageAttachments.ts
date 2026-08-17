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
  name: 'chat_message_attachments',
  title: '{{t("Chat attachments", { ns: "@log-company/plugin-chats" })}}',
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
    { name: 'chat_message_attachments_storage_key_unique', unique: true, fields: ['storage_key'] },
    { name: 'chat_message_attachments_message_idx', fields: ['message_id'] },
  ],
  fields: [
    { type: 'snowflakeId', name: 'id', interface: 'snowflakeId', primaryKey: true, allowNull: false },
    { type: 'bigInt', name: 'message_id', interface: 'integer', isForeignKey: true, allowNull: false },
    { type: 'string', name: 'storage_key', interface: 'input', allowNull: false, unique: true },
    { type: 'string', name: 'file_name', interface: 'input', allowNull: false },
    { type: 'string', name: 'mime_type', interface: 'input', allowNull: false },
    { type: 'bigInt', name: 'size', interface: 'integer', allowNull: false },
    { type: 'date', name: 'created_at', interface: 'datetime', allowNull: false },
  ],
});
