/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { normalizeMessageText } from '../domain/chat/ChatPolicy';
import { ChatUserNotFoundError, ChatValidationError, MessageNotFoundError } from '../domain/chat/ChatErrors';
import { ChatAccessService } from './ChatAccessService';
import type { ChatMessageDto } from './dto/ChatDto';
import type { ChatMessageRepository } from './ports/ChatMessageRepository';
import type { ChatRepository } from './ports/ChatRepository';
import type { Clock } from './ports/Clock';
import type { IdGenerator } from './ports/IdGenerator';
import type { TransactionManager } from './ports/TransactionManager';
import type { UserDirectory } from './ports/UserDirectory';

export interface SendChatMessageInput {
  chatId: string;
  actorId: string;
  text: string;
  replyToMessageId: string | null;
}

export class SendChatMessage {
  constructor(
    private readonly access: ChatAccessService,
    private readonly chats: ChatRepository,
    private readonly messages: ChatMessageRepository,
    private readonly users: UserDirectory,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: SendChatMessageInput): Promise<ChatMessageDto> {
    const text = normalizeMessageText(input.text, true);
    if (!text) {
      throw new ChatValidationError();
    }
    return this.transactions.execute(async (transaction) => {
      await this.access.requireAvailableSender(input.chatId, input.actorId, transaction);
      const actor = await this.users.findById(input.actorId, transaction);
      if (!actor) {
        throw new ChatUserNotFoundError();
      }
      if (input.replyToMessageId) {
        const replied = await this.messages.findById(input.replyToMessageId, transaction);
        if (!replied || replied.chatId !== input.chatId || replied.deletedAt) {
          throw new MessageNotFoundError();
        }
      }
      const now = this.clock.now();
      const message = await this.messages.create(
        {
          id: this.ids.generate(),
          chatId: input.chatId,
          authorId: actor.id,
          authorName: actor.name,
          text,
          messageType: 'text',
          replyToMessageId: input.replyToMessageId,
          createdAt: now,
        },
        transaction,
      );
      await this.chats.updateLastMessageAt(input.chatId, now, transaction);
      return { ...message, canDelete: true };
    });
  }
}
