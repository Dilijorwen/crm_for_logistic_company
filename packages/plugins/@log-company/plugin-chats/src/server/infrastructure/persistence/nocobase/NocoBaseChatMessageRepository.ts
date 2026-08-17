/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import type { ChatMessageDto } from '../../../application/dto/ChatDto';
import type {
  ChatMessageRepository,
  CreateChatMessageInput,
  MessageCursor,
} from '../../../application/ports/ChatMessageRepository';
import type { TransactionContext } from '../../../application/ports/TransactionManager';
import { parseSystemMessage } from '../../../domain/chat/SystemMessage';
import type { ChatMessageType } from '../../../domain/chat/ChatTypes';
import { NocoBaseTransactionManager } from '../../nocobase/NocoBaseTransactionManager';

interface MessageRow {
  id: string | number | bigint;
  chat_id: string | number | bigint;
  author_id: string | number | bigint | null;
  author_name: string;
  text: string | null;
  message_type: ChatMessageType;
  reply_to_message_id: string | number | bigint | null;
  created_at: Date | string;
  deleted_at: Date | string | null;
  deleted_by_id: string | number | bigint | null;
}

export class NocoBaseChatMessageRepository implements ChatMessageRepository {
  constructor(private readonly plugin: Plugin) {}

  async create(input: CreateChatMessageInput, transaction: TransactionContext): Promise<ChatMessageDto> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        insert into chat_messages
          (id, chat_id, author_id, author_name, text, message_type, reply_to_message_id, created_at, deleted_at, deleted_by_id)
        values
          (:id, :chatId, :authorId, :authorName, :text, :messageType, :replyToMessageId, :createdAt, null, null)
        returning *
      `,
      {
        replacements: { ...input },
        transaction: NocoBaseTransactionManager.asTransaction(transaction),
      },
    )) as unknown as [MessageRow[], unknown];
    return this.mapMessage(rows[0], input.authorId);
  }

  async findById(messageId: string, transaction?: TransactionContext): Promise<ChatMessageDto | null> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `select * from chat_messages where id = :messageId limit 1 ${transaction ? 'for update' : ''}`,
      {
        replacements: { messageId },
        transaction: NocoBaseTransactionManager.asTransaction(transaction),
      },
    )) as unknown as [MessageRow[], unknown];
    return rows[0] ? this.mapMessage(rows[0], null) : null;
  }

  async list(chatId: string, cursor: MessageCursor | null, limit: number, actorId: string): Promise<ChatMessageDto[]> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        select *
        from chat_messages
        where chat_id = :chatId
          and (
            :cursorCreatedAt::timestamptz is null
            or (created_at, id) < (:cursorCreatedAt::timestamptz, :cursorId::bigint)
          )
        order by created_at desc, id desc
        limit :limit
      `,
      {
        replacements: {
          chatId,
          cursorCreatedAt: cursor?.createdAt || null,
          cursorId: cursor?.id || null,
          limit,
        },
      },
    )) as unknown as [MessageRow[], unknown];
    return rows.map((row) => this.mapMessage(row, actorId));
  }

  async softDelete(
    messageId: string,
    actorId: string,
    deletedAt: Date,
    transaction: TransactionContext,
  ): Promise<void> {
    await this.plugin.db.sequelize.query(
      `
        update chat_messages
        set deleted_at = :deletedAt, deleted_by_id = :actorId
        where id = :messageId and deleted_at is null
      `,
      {
        replacements: { messageId, actorId, deletedAt },
        transaction: NocoBaseTransactionManager.asTransaction(transaction),
      },
    );
  }

  async anonymizeUser(userId: string, transaction: TransactionContext): Promise<void> {
    await this.plugin.db.sequelize.query(
      `
        update chat_messages
        set
          author_id = case when author_id = :userId then null else author_id end,
          deleted_by_id = case when deleted_by_id = :userId then null else deleted_by_id end
        where author_id = :userId or deleted_by_id = :userId
      `,
      {
        replacements: { userId },
        transaction: NocoBaseTransactionManager.asTransaction(transaction),
      },
    );
  }

  private mapMessage(row: MessageRow, actorId: string | null): ChatMessageDto {
    const deleted = Boolean(row.deleted_at);
    const authorId = row.author_id == null ? null : String(row.author_id);
    return {
      id: String(row.id),
      chatId: String(row.chat_id),
      authorId,
      authorName: row.author_name,
      text: deleted || row.message_type === 'system' ? null : row.text,
      messageType: row.message_type,
      systemEvent: deleted || row.message_type !== 'system' ? null : parseSystemMessage(row.text),
      replyToMessageId: row.reply_to_message_id == null ? null : String(row.reply_to_message_id),
      createdAt: row.created_at,
      deletedAt: row.deleted_at,
      deletedById: row.deleted_by_id == null ? null : String(row.deleted_by_id),
      attachments: [],
      canDelete: !deleted && Boolean(actorId && authorId === actorId),
    };
  }
}
