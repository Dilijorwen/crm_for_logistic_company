/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import type { ChatListItemDto, ChatRecord, LastChatMessageDto } from '../../../application/dto/ChatDto';
import type { ChatRepository, CreateChatInput } from '../../../application/ports/ChatRepository';
import type { TransactionContext } from '../../../application/ports/TransactionManager';
import { parseSystemMessage } from '../../../domain/chat/SystemMessage';
import type { ChatMessageType, ChatType } from '../../../domain/chat/ChatTypes';
import { NocoBaseTransactionManager } from '../../nocobase/NocoBaseTransactionManager';

interface ChatRow {
  id: string | number | bigint;
  type: ChatType;
  title: string | null;
  direct_key: string | null;
  created_by_id: string | number | bigint | null;
  created_at: Date | string;
  updated_at: Date | string;
  last_message_at: Date | string | null;
  deleted_at: Date | string | null;
}

interface ChatListRow extends ChatRow {
  display_title: string;
  unavailable: boolean;
  unread_count: string | number | bigint;
  last_text: string | null;
  last_author_name: string | null;
  last_created_at: Date | string | null;
  last_deleted_at: Date | string | null;
  last_message_type: ChatMessageType | null;
}

export class NocoBaseChatRepository implements ChatRepository {
  constructor(private readonly plugin: Plugin) {}

  async findById(chatId: string, transaction?: TransactionContext): Promise<ChatRecord | null> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `select * from chats where id = :chatId limit 1 ${transaction ? 'for update' : ''}`,
      {
        replacements: { chatId },
        transaction: NocoBaseTransactionManager.asTransaction(transaction),
      },
    )) as unknown as [ChatRow[], unknown];
    return rows[0] ? this.mapChat(rows[0]) : null;
  }

  async findByDirectKey(directKey: string, transaction?: TransactionContext): Promise<ChatRecord | null> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `select * from chats where type = 'direct' and direct_key = :directKey and deleted_at is null limit 1`,
      {
        replacements: { directKey },
        transaction: NocoBaseTransactionManager.asTransaction(transaction),
      },
    )) as unknown as [ChatRow[], unknown];
    return rows[0] ? this.mapChat(rows[0]) : null;
  }

  async create(input: CreateChatInput, transaction: TransactionContext): Promise<ChatRecord> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        insert into chats
          (id, type, title, direct_key, created_by_id, created_at, updated_at, last_message_at, deleted_at)
        values
          (:id, :type, :title, :directKey, :createdById, :now, :now, null, null)
        returning *
      `,
      {
        replacements: {
          id: input.id,
          type: input.type,
          title: input.title,
          directKey: input.directKey,
          createdById: input.createdById,
          now: input.now,
        },
        transaction: NocoBaseTransactionManager.asTransaction(transaction),
      },
    )) as unknown as [ChatRow[], unknown];
    return this.mapChat(rows[0]);
  }

  async createDirectIfAbsent(input: CreateChatInput, transaction: TransactionContext): Promise<ChatRecord | null> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        insert into chats
          (id, type, title, direct_key, created_by_id, created_at, updated_at, last_message_at, deleted_at)
        values
          (:id, 'direct', null, :directKey, :createdById, :now, :now, null, null)
        on conflict (direct_key) do nothing
        returning *
      `,
      {
        replacements: {
          id: input.id,
          directKey: input.directKey,
          createdById: input.createdById,
          now: input.now,
        },
        transaction: NocoBaseTransactionManager.asTransaction(transaction),
      },
    )) as unknown as [ChatRow[], unknown];
    return rows[0] ? this.mapChat(rows[0]) : null;
  }

  async listForUser(userId: string): Promise<ChatListItemDto[]> {
    return this.queryList(userId, null);
  }

  async getListItem(chatId: string, userId: string, transaction?: TransactionContext): Promise<ChatListItemDto | null> {
    const rows = await this.queryList(userId, chatId, transaction);
    return rows[0] || null;
  }

  async updateGroupTitle(chatId: string, title: string, now: Date, transaction: TransactionContext): Promise<void> {
    await this.plugin.db.sequelize.query(
      `update chats set title = :title, updated_at = :now where id = :chatId and type = 'group'`,
      {
        replacements: { chatId, title, now },
        transaction: NocoBaseTransactionManager.asTransaction(transaction),
      },
    );
  }

  async updateLastMessageAt(chatId: string, now: Date, transaction: TransactionContext): Promise<void> {
    await this.plugin.db.sequelize.query(
      `update chats set last_message_at = :now, updated_at = :now where id = :chatId`,
      {
        replacements: { chatId, now },
        transaction: NocoBaseTransactionManager.asTransaction(transaction),
      },
    );
  }

  async anonymizeCreator(userId: string, transaction: TransactionContext): Promise<void> {
    await this.plugin.db.sequelize.query(`update chats set created_by_id = null where created_by_id = :userId`, {
      replacements: { userId },
      transaction: NocoBaseTransactionManager.asTransaction(transaction),
    });
  }

  private async queryList(
    userId: string,
    chatId: string | null,
    transaction?: TransactionContext,
  ): Promise<ChatListItemDto[]> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        select
          c.*,
          case when c.type = 'group' then coalesce(c.title, '') else coalesce(other_member.member_name, '') end
            as display_title,
          case
            when c.type = 'direct' then coalesce(other_member.user_id is null or other_member.left_at is not null, true)
            else false
          end as unavailable,
          (
            select count(*)
            from chat_messages unread
            where unread.chat_id = c.id
              and unread.deleted_at is null
              and unread.created_at > coalesce(current_member.last_read_at, current_member.joined_at)
              and (unread.author_id is null or unread.author_id <> :userId)
          ) as unread_count,
          last_message.text as last_text,
          last_message.author_name as last_author_name,
          last_message.created_at as last_created_at,
          last_message.deleted_at as last_deleted_at,
          last_message.message_type as last_message_type
        from chats c
        join chat_members current_member
          on current_member.chat_id = c.id
         and current_member.user_id = :userId
         and current_member.left_at is null
        left join lateral (
          select member_name, user_id, left_at
          from chat_members other
          where other.chat_id = c.id and other.id <> current_member.id
          order by other.joined_at asc, other.id asc
          limit 1
        ) other_member on true
        left join lateral (
          select text, author_name, created_at, deleted_at, message_type
          from chat_messages message
          where message.chat_id = c.id
          order by message.created_at desc, message.id desc
          limit 1
        ) last_message on true
        where c.deleted_at is null
          and (:chatId::bigint is null or c.id = :chatId)
        order by c.last_message_at desc nulls last, c.updated_at desc, c.id desc
      `,
      {
        replacements: { userId, chatId },
        transaction: NocoBaseTransactionManager.asTransaction(transaction),
      },
    )) as unknown as [ChatListRow[], unknown];
    return rows.map((row) => this.mapListItem(row));
  }

  private mapChat(row: ChatRow): ChatRecord {
    return {
      id: String(row.id),
      type: row.type,
      title: row.title,
      directKey: row.direct_key,
      createdById: row.created_by_id == null ? null : String(row.created_by_id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastMessageAt: row.last_message_at,
      deletedAt: row.deleted_at,
    };
  }

  private mapListItem(row: ChatListRow): ChatListItemDto {
    return {
      id: String(row.id),
      type: row.type,
      title: row.display_title,
      unavailable: Boolean(row.unavailable),
      lastMessage: this.mapLastMessage(row),
      unreadCount: Number(row.unread_count),
      updatedAt: row.updated_at,
    };
  }

  private mapLastMessage(row: ChatListRow): LastChatMessageDto | null {
    if (!row.last_created_at || !row.last_message_type) {
      return null;
    }
    const deleted = Boolean(row.last_deleted_at);
    return {
      text: deleted || row.last_message_type === 'system' ? null : row.last_text,
      authorName: row.last_author_name || '',
      createdAt: row.last_created_at,
      deleted,
      messageType: row.last_message_type,
      systemEvent: deleted || row.last_message_type !== 'system' ? null : parseSystemMessage(row.last_text),
    };
  }
}
