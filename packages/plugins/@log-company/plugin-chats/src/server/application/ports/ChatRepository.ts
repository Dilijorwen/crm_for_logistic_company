/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { ChatListItemDto, ChatRecord } from '../dto/ChatDto';
import type { TransactionContext } from './TransactionManager';

export interface CreateChatInput {
  id: string;
  type: 'direct' | 'group';
  title: string | null;
  directKey: string | null;
  createdById: string;
  now: Date;
}

export interface ChatRepository {
  findById(chatId: string, transaction?: TransactionContext): Promise<ChatRecord | null>;
  findByDirectKey(directKey: string, transaction?: TransactionContext): Promise<ChatRecord | null>;
  create(input: CreateChatInput, transaction: TransactionContext): Promise<ChatRecord>;
  createDirectIfAbsent(input: CreateChatInput, transaction: TransactionContext): Promise<ChatRecord | null>;
  listForUser(userId: string): Promise<ChatListItemDto[]>;
  getListItem(chatId: string, userId: string, transaction?: TransactionContext): Promise<ChatListItemDto | null>;
  updateGroupTitle(chatId: string, title: string, now: Date, transaction: TransactionContext): Promise<void>;
  updateLastMessageAt(chatId: string, now: Date, transaction: TransactionContext): Promise<void>;
  anonymizeCreator(userId: string, transaction: TransactionContext): Promise<void>;
}
