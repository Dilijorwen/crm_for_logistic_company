/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { assertMemberCanBeRemoved } from '../domain/chat/ChatPolicy';
import { ChatMemberNotFoundError, ChatUserNotFoundError } from '../domain/chat/ChatErrors';
import { serializeSystemMessage } from '../domain/chat/SystemMessage';
import { ChatAccessService } from './ChatAccessService';
import type { ChatMemberRepository } from './ports/ChatMemberRepository';
import type { ChatMessageRepository } from './ports/ChatMessageRepository';
import type { ChatRepository } from './ports/ChatRepository';
import type { Clock } from './ports/Clock';
import type { IdGenerator } from './ports/IdGenerator';
import type { TransactionManager } from './ports/TransactionManager';
import type { UserDirectory } from './ports/UserDirectory';

export interface RemoveChatMemberInput {
  chatId: string;
  actorId: string;
  userId: string;
}

export class RemoveChatMember {
  constructor(
    private readonly access: ChatAccessService,
    private readonly chats: ChatRepository,
    private readonly members: ChatMemberRepository,
    private readonly messages: ChatMessageRepository,
    private readonly users: UserDirectory,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: RemoveChatMemberInput): Promise<void> {
    await this.transactions.execute(async (transaction) => {
      await this.access.requireManager(input.chatId, input.actorId, transaction);
      const actor = await this.users.findById(input.actorId, transaction);
      if (!actor) {
        throw new ChatUserNotFoundError();
      }
      const target = await this.members.findActive(input.chatId, input.userId, transaction);
      if (!target) {
        throw new ChatMemberNotFoundError();
      }
      assertMemberCanBeRemoved(target.role);
      const now = this.clock.now();
      await this.members.markLeft(target.id, now, transaction);
      await this.messages.create(
        {
          id: this.ids.generate(),
          chatId: input.chatId,
          authorId: actor.id,
          authorName: actor.name,
          text: serializeSystemMessage({
            key: 'memberRemoved',
            actorName: actor.name,
            subjectName: target.memberName,
          }),
          messageType: 'system',
          replyToMessageId: null,
          createdAt: now,
        },
        transaction,
      );
      await this.chats.updateLastMessageAt(input.chatId, now, transaction);
    });
  }
}
