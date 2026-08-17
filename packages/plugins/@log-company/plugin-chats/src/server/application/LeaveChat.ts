/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { assertMemberCanBeRemoved } from '../domain/chat/ChatPolicy';
import { ChatUserNotFoundError, GroupChatRequiredError } from '../domain/chat/ChatErrors';
import { serializeSystemMessage } from '../domain/chat/SystemMessage';
import { ChatAccessService } from './ChatAccessService';
import type { ChatMemberRepository } from './ports/ChatMemberRepository';
import type { ChatMessageRepository } from './ports/ChatMessageRepository';
import type { ChatRepository } from './ports/ChatRepository';
import type { Clock } from './ports/Clock';
import type { IdGenerator } from './ports/IdGenerator';
import type { TransactionManager } from './ports/TransactionManager';
import type { UserDirectory } from './ports/UserDirectory';

export class LeaveChat {
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

  async execute(chatId: string, actorId: string): Promise<void> {
    await this.transactions.execute(async (transaction) => {
      const { chat, member } = await this.access.requireActiveMember(chatId, actorId, transaction);
      if (chat.type !== 'group') {
        throw new GroupChatRequiredError();
      }
      assertMemberCanBeRemoved(member.role);
      const actor = await this.users.findById(actorId, transaction);
      if (!actor) {
        throw new ChatUserNotFoundError();
      }
      const now = this.clock.now();
      await this.members.markLeft(member.id, now, transaction);
      await this.messages.create(
        {
          id: this.ids.generate(),
          chatId,
          authorId: actor.id,
          authorName: actor.name,
          text: serializeSystemMessage({ key: 'memberLeft', actorName: actor.name, subjectName: actor.name }),
          messageType: 'system',
          replyToMessageId: null,
          createdAt: now,
        },
        transaction,
      );
      await this.chats.updateLastMessageAt(chatId, now, transaction);
    });
  }
}
