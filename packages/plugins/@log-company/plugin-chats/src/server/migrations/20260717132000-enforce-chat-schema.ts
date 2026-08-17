/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import { CHAT_LIMITS } from '../../shared/chatLimits';

export default class extends Migration {
  on = 'afterSync';

  async up(): Promise<void> {
    await this.db.sequelize.transaction(async (transaction) => {
      await this.db.sequelize.query(
        `
          do $$
          begin
            if not exists (select 1 from pg_constraint where conname = 'chats_type_check') then
              alter table chats add constraint chats_type_check check (type in ('direct', 'group'));
            end if;
            if not exists (select 1 from pg_constraint where conname = 'chats_shape_check') then
              alter table chats add constraint chats_shape_check check (
                (type = 'direct' and direct_key is not null and title is null)
                or (type = 'group' and direct_key is null and nullif(btrim(title), '') is not null)
              );
            end if;
            if not exists (select 1 from pg_constraint where conname = 'chats_created_by_id_fkey') then
              alter table chats add constraint chats_created_by_id_fkey foreign key (created_by_id)
                references users(id) on update cascade on delete set null;
            end if;

            if not exists (select 1 from pg_constraint where conname = 'chat_members_role_check') then
              alter table chat_members add constraint chat_members_role_check check (role in ('owner', 'admin', 'member'));
            end if;
            if not exists (select 1 from pg_constraint where conname = 'chat_members_chat_id_fkey') then
              alter table chat_members add constraint chat_members_chat_id_fkey foreign key (chat_id)
                references chats(id) on update cascade on delete cascade;
            end if;
            if not exists (select 1 from pg_constraint where conname = 'chat_members_user_id_fkey') then
              alter table chat_members add constraint chat_members_user_id_fkey foreign key (user_id)
                references users(id) on update cascade on delete set null;
            end if;

            if not exists (select 1 from pg_constraint where conname = 'chat_messages_type_check') then
              alter table chat_messages add constraint chat_messages_type_check
                check (message_type in ('text', 'system', 'file'));
            end if;
            if not exists (select 1 from pg_constraint where conname = 'chat_messages_text_length_check') then
              alter table chat_messages add constraint chat_messages_text_length_check
                check (text is null or char_length(text) <= ${CHAT_LIMITS.maximumMessageLength});
            end if;
            if not exists (select 1 from pg_constraint where conname = 'chat_messages_chat_id_fkey') then
              alter table chat_messages add constraint chat_messages_chat_id_fkey foreign key (chat_id)
                references chats(id) on update cascade on delete cascade;
            end if;
            if not exists (select 1 from pg_constraint where conname = 'chat_messages_author_id_fkey') then
              alter table chat_messages add constraint chat_messages_author_id_fkey foreign key (author_id)
                references users(id) on update cascade on delete set null;
            end if;
            if not exists (select 1 from pg_constraint where conname = 'chat_messages_reply_to_message_id_fkey') then
              alter table chat_messages add constraint chat_messages_reply_to_message_id_fkey foreign key (reply_to_message_id)
                references chat_messages(id) on update cascade on delete set null;
            end if;
            if not exists (select 1 from pg_constraint where conname = 'chat_messages_deleted_by_id_fkey') then
              alter table chat_messages add constraint chat_messages_deleted_by_id_fkey foreign key (deleted_by_id)
                references users(id) on update cascade on delete set null;
            end if;

            if not exists (select 1 from pg_constraint where conname = 'chat_message_attachments_size_check') then
              alter table chat_message_attachments add constraint chat_message_attachments_size_check
                check (size > 0 and size <= ${CHAT_LIMITS.maximumAttachmentSizeBytes});
            end if;
            if not exists (select 1 from pg_constraint where conname = 'chat_message_attachments_message_id_fkey') then
              alter table chat_message_attachments add constraint chat_message_attachments_message_id_fkey foreign key (message_id)
                references chat_messages(id) on update cascade on delete cascade;
            end if;
          end
          $$;

          create unique index if not exists chats_direct_key_unique on chats(direct_key);
          create index if not exists chats_last_message_at_idx on chats(last_message_at desc nulls last);
          create unique index if not exists chat_members_active_user_unique
            on chat_members(chat_id, user_id) where left_at is null and user_id is not null;
          create index if not exists chat_members_user_left_idx on chat_members(user_id, left_at);
          create index if not exists chat_members_chat_idx on chat_members(chat_id, joined_at, id);
          create index if not exists chat_messages_chat_created_idx
            on chat_messages(chat_id, created_at desc, id desc);
          create unique index if not exists chat_message_attachments_storage_key_unique
            on chat_message_attachments(storage_key);
          create index if not exists chat_message_attachments_message_idx
            on chat_message_attachments(message_id);
        `,
        { transaction },
      );
    });
  }

  async down(): Promise<void> {
    await this.db.sequelize.query(
      `
        drop index if exists chat_message_attachments_message_idx;
        drop index if exists chat_message_attachments_storage_key_unique;
        drop index if exists chat_messages_chat_created_idx;
        drop index if exists chat_members_chat_idx;
        drop index if exists chat_members_user_left_idx;
        drop index if exists chat_members_active_user_unique;
        drop index if exists chats_last_message_at_idx;
        drop index if exists chats_direct_key_unique;
        alter table chat_message_attachments
          drop constraint if exists chat_message_attachments_message_id_fkey,
          drop constraint if exists chat_message_attachments_size_check;
        alter table chat_messages
          drop constraint if exists chat_messages_deleted_by_id_fkey,
          drop constraint if exists chat_messages_reply_to_message_id_fkey,
          drop constraint if exists chat_messages_author_id_fkey,
          drop constraint if exists chat_messages_chat_id_fkey,
          drop constraint if exists chat_messages_text_length_check,
          drop constraint if exists chat_messages_type_check;
        alter table chat_members
          drop constraint if exists chat_members_user_id_fkey,
          drop constraint if exists chat_members_chat_id_fkey,
          drop constraint if exists chat_members_role_check;
        alter table chats
          drop constraint if exists chats_created_by_id_fkey,
          drop constraint if exists chats_shape_check,
          drop constraint if exists chats_type_check;
      `,
    );
  }
}
