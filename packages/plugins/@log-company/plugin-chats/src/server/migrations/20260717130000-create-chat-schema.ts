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
import { CHAT_LIMITS } from '../../shared/chatLimits';

const COLLECTIONS = ['chats', 'chat_members', 'chat_messages', 'chat_message_attachments'] as const;

interface CollectionsMetadataRepository {
  findOne(options: { filter: { name: string } }): Promise<unknown>;
  db2cm?(name: string): Promise<void>;
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const queryInterface = this.db.sequelize.getQueryInterface();
    await this.db.sequelize.transaction(async (transaction) => {
      if (!(await queryInterface.tableExists('chats', { transaction }))) {
        await queryInterface.createTable(
          'chats',
          {
            id: { type: DataTypes.BIGINT, allowNull: false, primaryKey: true },
            type: { type: DataTypes.STRING(16), allowNull: false },
            title: { type: DataTypes.STRING(160), allowNull: true },
            direct_key: { type: DataTypes.STRING(255), allowNull: true },
            created_by_id: {
              type: DataTypes.BIGINT,
              allowNull: true,
              references: { model: 'users', key: 'id' },
              onDelete: 'SET NULL',
              onUpdate: 'CASCADE',
            },
            created_at: { type: DataTypes.DATE, allowNull: false },
            updated_at: { type: DataTypes.DATE, allowNull: false },
            last_message_at: { type: DataTypes.DATE, allowNull: true },
            deleted_at: { type: DataTypes.DATE, allowNull: true },
          },
          { transaction },
        );
        await this.db.sequelize.query(
          `
            alter table chats add constraint chats_type_check check (type in ('direct', 'group'));
            alter table chats add constraint chats_shape_check check (
              (type = 'direct' and direct_key is not null and title is null)
              or (type = 'group' and direct_key is null and nullif(btrim(title), '') is not null)
            );
            create unique index chats_direct_key_unique on chats(direct_key);
            create index chats_last_message_at_idx on chats(last_message_at desc nulls last);
          `,
          { transaction },
        );
      }

      if (!(await queryInterface.tableExists('chat_members', { transaction }))) {
        await queryInterface.createTable(
          'chat_members',
          {
            id: { type: DataTypes.BIGINT, allowNull: false, primaryKey: true },
            chat_id: {
              type: DataTypes.BIGINT,
              allowNull: false,
              references: { model: 'chats', key: 'id' },
              onDelete: 'CASCADE',
              onUpdate: 'CASCADE',
            },
            user_id: {
              type: DataTypes.BIGINT,
              allowNull: true,
              references: { model: 'users', key: 'id' },
              onDelete: 'SET NULL',
              onUpdate: 'CASCADE',
            },
            member_name: { type: DataTypes.STRING(255), allowNull: false },
            role: { type: DataTypes.STRING(16), allowNull: false },
            joined_at: { type: DataTypes.DATE, allowNull: false },
            left_at: { type: DataTypes.DATE, allowNull: true },
            last_read_at: { type: DataTypes.DATE, allowNull: true },
            is_muted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
          },
          { transaction },
        );
        await this.db.sequelize.query(
          `
            alter table chat_members add constraint chat_members_role_check check (role in ('owner', 'admin', 'member'));
            create unique index chat_members_active_user_unique
              on chat_members(chat_id, user_id)
              where left_at is null and user_id is not null;
            create index chat_members_user_left_idx on chat_members(user_id, left_at);
            create index chat_members_chat_idx on chat_members(chat_id, joined_at, id);
          `,
          { transaction },
        );
      }

      if (!(await queryInterface.tableExists('chat_messages', { transaction }))) {
        await queryInterface.createTable(
          'chat_messages',
          {
            id: { type: DataTypes.BIGINT, allowNull: false, primaryKey: true },
            chat_id: {
              type: DataTypes.BIGINT,
              allowNull: false,
              references: { model: 'chats', key: 'id' },
              onDelete: 'CASCADE',
              onUpdate: 'CASCADE',
            },
            author_id: {
              type: DataTypes.BIGINT,
              allowNull: true,
              references: { model: 'users', key: 'id' },
              onDelete: 'SET NULL',
              onUpdate: 'CASCADE',
            },
            author_name: { type: DataTypes.STRING(255), allowNull: false },
            text: { type: DataTypes.TEXT, allowNull: true },
            message_type: { type: DataTypes.STRING(16), allowNull: false },
            reply_to_message_id: {
              type: DataTypes.BIGINT,
              allowNull: true,
              references: { model: 'chat_messages', key: 'id' },
              onDelete: 'SET NULL',
              onUpdate: 'CASCADE',
            },
            created_at: { type: DataTypes.DATE, allowNull: false },
            deleted_at: { type: DataTypes.DATE, allowNull: true },
            deleted_by_id: {
              type: DataTypes.BIGINT,
              allowNull: true,
              references: { model: 'users', key: 'id' },
              onDelete: 'SET NULL',
              onUpdate: 'CASCADE',
            },
          },
          { transaction },
        );
        await this.db.sequelize.query(
          `
            alter table chat_messages add constraint chat_messages_type_check
              check (message_type in ('text', 'system', 'file'));
            alter table chat_messages add constraint chat_messages_text_length_check
              check (text is null or char_length(text) <= ${CHAT_LIMITS.maximumMessageLength});
            create index chat_messages_chat_created_idx on chat_messages(chat_id, created_at desc, id desc);
          `,
          { transaction },
        );
      }

      if (!(await queryInterface.tableExists('chat_message_attachments', { transaction }))) {
        await queryInterface.createTable(
          'chat_message_attachments',
          {
            id: { type: DataTypes.BIGINT, allowNull: false, primaryKey: true },
            message_id: {
              type: DataTypes.BIGINT,
              allowNull: false,
              references: { model: 'chat_messages', key: 'id' },
              onDelete: 'CASCADE',
              onUpdate: 'CASCADE',
            },
            storage_key: { type: DataTypes.STRING(512), allowNull: false, unique: true },
            file_name: { type: DataTypes.STRING(255), allowNull: false },
            mime_type: { type: DataTypes.STRING(255), allowNull: false },
            size: { type: DataTypes.BIGINT, allowNull: false },
            created_at: { type: DataTypes.DATE, allowNull: false },
          },
          { transaction },
        );
        await this.db.sequelize.query(
          `
            alter table chat_message_attachments add constraint chat_message_attachments_size_check
              check (size > 0 and size <= ${CHAT_LIMITS.maximumAttachmentSizeBytes});
            create index chat_message_attachments_message_idx on chat_message_attachments(message_id);
          `,
          { transaction },
        );
      }
    });

    const metadata = this.db.getRepository('collections') as unknown as CollectionsMetadataRepository;
    for (const name of COLLECTIONS) {
      const exists = await metadata.findOne({ filter: { name } });
      if (!exists && metadata.db2cm) {
        await metadata.db2cm(name);
      }
    }
  }

  async down(): Promise<void> {
    await this.db.sequelize.transaction(async (transaction) => {
      await this.db.sequelize.query(
        `delete from fields where "collectionName" in (:collections); delete from collections where name in (:collections);`,
        { replacements: { collections: [...COLLECTIONS] }, transaction },
      );
      await this.db.sequelize.query(
        `
          drop table if exists chat_message_attachments;
          drop table if exists chat_messages;
          drop table if exists chat_members;
          drop table if exists chats;
        `,
        { transaction },
      );
    });
  }
}
