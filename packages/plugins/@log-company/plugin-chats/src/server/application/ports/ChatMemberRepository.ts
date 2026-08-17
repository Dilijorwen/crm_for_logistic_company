/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { ChatMemberDto } from '../dto/ChatDto';
import type { ChatMemberRole } from '../../domain/chat/ChatTypes';
import type { TransactionContext } from './TransactionManager';

export interface CreateChatMemberInput {
  id: string;
  chatId: string;
  userId: string;
  memberName: string;
  role: ChatMemberRole;
  joinedAt: Date;
  lastReadAt: Date;
}

export interface ChatMemberRepository {
  create(input: CreateChatMemberInput, transaction: TransactionContext): Promise<ChatMemberDto>;
  createIfAbsent(input: CreateChatMemberInput, transaction: TransactionContext): Promise<ChatMemberDto | null>;
  findMembership(chatId: string, userId: string, transaction?: TransactionContext): Promise<ChatMemberDto | null>;
  findActive(chatId: string, userId: string, transaction?: TransactionContext): Promise<ChatMemberDto | null>;
  listByChat(chatId: string, transaction?: TransactionContext): Promise<ChatMemberDto[]>;
  markLeft(memberId: string, leftAt: Date, transaction: TransactionContext): Promise<void>;
  markRead(chatId: string, userId: string, readAt: Date, transaction: TransactionContext): Promise<void>;
  countUnreadChats(userId: string): Promise<number>;
  isDirectChatAvailable(chatId: string, transaction?: TransactionContext): Promise<boolean>;
  deactivateUser(userId: string, leftAt: Date, transaction: TransactionContext): Promise<void>;
}
