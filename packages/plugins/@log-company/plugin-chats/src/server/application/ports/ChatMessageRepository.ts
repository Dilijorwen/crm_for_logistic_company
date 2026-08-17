/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { ChatMessageDto } from '../dto/ChatDto';
import type { ChatMessageType } from '../../domain/chat/ChatTypes';
import type { TransactionContext } from './TransactionManager';

export interface CreateChatMessageInput {
  id: string;
  chatId: string;
  authorId: string;
  authorName: string;
  text: string | null;
  messageType: ChatMessageType;
  replyToMessageId: string | null;
  createdAt: Date;
}

export interface MessageCursor {
  createdAt: string;
  id: string;
}

export interface ChatMessageRepository {
  create(input: CreateChatMessageInput, transaction: TransactionContext): Promise<ChatMessageDto>;
  findById(messageId: string, transaction?: TransactionContext): Promise<ChatMessageDto | null>;
  list(chatId: string, cursor: MessageCursor | null, limit: number, actorId: string): Promise<ChatMessageDto[]>;
  softDelete(messageId: string, actorId: string, deletedAt: Date, transaction: TransactionContext): Promise<void>;
  anonymizeUser(userId: string, transaction: TransactionContext): Promise<void>;
}
