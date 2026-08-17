/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import type { ChatMemberDto } from '../../../application/dto/ChatDto';
import type { ChatMemberRepository, CreateChatMemberInput } from '../../../application/ports/ChatMemberRepository';
import type { TransactionContext } from '../../../application/ports/TransactionManager';
import type { ChatMemberRole } from '../../../domain/chat/ChatTypes';
import { NocoBaseTransactionManager } from '../../nocobase/NocoBaseTransactionManager';

interface MemberRow {
  id: string | number | bigint;
  chat_id: string | number | bigint;
  user_id: string | number | bigint | null;
  member_name: string;
  role: ChatMemberRole;
  joined_at: Date | string;
  left_at: Date | string | null;
  last_read_at: Date | string | null;
  is_muted: boolean;
}

export class NocoBaseChatMemberRepository implements ChatMemberRepository {
  constructor(private readonly plugin: Plugin) {}

  async create(input: CreateChatMemberInput, transaction: TransactionContext): Promise<ChatMemberDto> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        insert into chat_members
          (id, chat_id, user_id, member_name, role, joined_at, left_at, last_read_at, is_muted)
        values
          (:id, :chatId, :userId, :memberName, :role, :joinedAt, null, :lastReadAt, false)
        returning *
      `,
      {
        replacements: { ...input },
        transaction: NocoBaseTransactionManager.asTransaction(transaction),
      },
    )) as unknown as [MemberRow[], unknown];
    return this.mapMember(rows[0]);
  }

  async createIfAbsent(input: CreateChatMemberInput, transaction: TransactionContext): Promise<ChatMemberDto | null> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        insert into chat_members
          (id, chat_id, user_id, member_name, role, joined_at, left_at, last_read_at, is_muted)
        values
          (:id, :chatId, :userId, :memberName, :role, :joinedAt, null, :lastReadAt, false)
        on conflict (chat_id, user_id) where left_at is null and user_id is not null do nothing
        returning *
      `,
      {
        replacements: { ...input },
        transaction: NocoBaseTransactionManager.asTransaction(transaction),
      },
    )) as unknown as [MemberRow[], unknown];
    return rows[0] ? this.mapMember(rows[0]) : null;
  }

  async findMembership(
    chatId: string,
    userId: string,
    transaction?: TransactionContext,
  ): Promise<ChatMemberDto | null> {
    const rows = await this.findRows(`chat_id = :chatId and user_id = :userId`, { chatId, userId }, transaction, 1);
    return rows[0] ? this.mapMember(rows[0]) : null;
  }

  async findActive(chatId: string, userId: string, transaction?: TransactionContext): Promise<ChatMemberDto | null> {
    const rows = await this.findRows(
      `chat_id = :chatId and user_id = :userId and left_at is null`,
      { chatId, userId },
      transaction,
      1,
    );
    return rows[0] ? this.mapMember(rows[0]) : null;
  }

  async listByChat(chatId: string, transaction?: TransactionContext): Promise<ChatMemberDto[]> {
    const rows = await this.findRows(`chat_id = :chatId`, { chatId }, transaction);
    return rows.map((row) => this.mapMember(row));
  }

  async markLeft(memberId: string, leftAt: Date, transaction: TransactionContext): Promise<void> {
    await this.plugin.db.sequelize.query(
      `update chat_members set left_at = :leftAt where id = :memberId and left_at is null`,
      {
        replacements: { memberId, leftAt },
        transaction: NocoBaseTransactionManager.asTransaction(transaction),
      },
    );
  }

  async markRead(chatId: string, userId: string, readAt: Date, transaction: TransactionContext): Promise<void> {
    await this.plugin.db.sequelize.query(
      `
        update chat_members
        set last_read_at = :readAt
        where chat_id = :chatId and user_id = :userId and left_at is null
      `,
      {
        replacements: { chatId, userId, readAt },
        transaction: NocoBaseTransactionManager.asTransaction(transaction),
      },
    );
  }

  async countUnreadChats(userId: string): Promise<number> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        select count(*) as count
        from chat_members member
        join chats chat on chat.id = member.chat_id and chat.deleted_at is null
        where member.user_id = :userId
          and member.left_at is null
          and exists (
            select 1
            from chat_messages message
            where message.chat_id = member.chat_id
              and message.deleted_at is null
              and message.created_at > coalesce(member.last_read_at, member.joined_at)
              and (message.author_id is null or message.author_id <> :userId)
          )
      `,
      { replacements: { userId } },
    )) as unknown as [Array<{ count: string | number | bigint }>, unknown];
    return Number(rows[0]?.count || 0);
  }

  async isDirectChatAvailable(chatId: string, transaction?: TransactionContext): Promise<boolean> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        select count(*) filter (where member.user_id is not null and member.left_at is null) as active_count
        from chat_members member
        join chats chat on chat.id = member.chat_id and chat.type = 'direct'
        where member.chat_id = :chatId
      `,
      {
        replacements: { chatId },
        transaction: NocoBaseTransactionManager.asTransaction(transaction),
      },
    )) as unknown as [Array<{ active_count: string | number | bigint }>, unknown];
    return Number(rows[0]?.active_count || 0) === 2;
  }

  async deactivateUser(userId: string, leftAt: Date, transaction: TransactionContext): Promise<void> {
    await this.plugin.db.sequelize.query(
      `
        update chat_members
        set left_at = coalesce(left_at, :leftAt), user_id = null
        where user_id = :userId
      `,
      {
        replacements: { userId, leftAt },
        transaction: NocoBaseTransactionManager.asTransaction(transaction),
      },
    );
  }

  private async findRows(
    predicate: string,
    replacements: Record<string, unknown>,
    transaction?: TransactionContext,
    limit?: number,
  ): Promise<MemberRow[]> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        select *
        from chat_members
        where ${predicate}
        order by (left_at is null) desc, joined_at desc, id desc
        ${limit ? `limit ${limit}` : ''}
        ${transaction ? 'for update' : ''}
      `,
      {
        replacements,
        transaction: NocoBaseTransactionManager.asTransaction(transaction),
      },
    )) as unknown as [MemberRow[], unknown];
    return rows;
  }

  private mapMember(row: MemberRow): ChatMemberDto {
    return {
      id: String(row.id),
      userId: row.user_id == null ? null : String(row.user_id),
      memberName: row.member_name,
      role: row.role,
      joinedAt: row.joined_at,
      leftAt: row.left_at,
      lastReadAt: row.last_read_at,
      isMuted: Boolean(row.is_muted),
      deleted: row.user_id == null,
    };
  }
}
