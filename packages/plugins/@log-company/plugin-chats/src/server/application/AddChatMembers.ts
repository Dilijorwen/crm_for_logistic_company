/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { CHAT_LIMITS } from '../../shared/chatLimits';
import { ChatUserNotFoundError, ChatValidationError } from '../domain/chat/ChatErrors';
import { serializeSystemMessage } from '../domain/chat/SystemMessage';
import { ChatAccessService } from './ChatAccessService';
import type { ChatMemberRepository } from './ports/ChatMemberRepository';
import type { ChatMessageRepository } from './ports/ChatMessageRepository';
import type { ChatRepository } from './ports/ChatRepository';
import type { Clock } from './ports/Clock';
import type { IdGenerator } from './ports/IdGenerator';
import type { TransactionManager } from './ports/TransactionManager';
import type { UserDirectory } from './ports/UserDirectory';

export interface AddChatMembersInput {
  chatId: string;
  actorId: string;
  userIds: string[];
}

export class AddChatMembers {
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

  async execute(input: AddChatMembersInput): Promise<void> {
    const userIds = Array.from(new Set(input.userIds)).filter((userId) => userId !== input.actorId);
    if (userIds.length > CHAT_LIMITS.maximumGroupParticipants) {
      throw new ChatValidationError();
    }
    await this.transactions.execute(async (transaction) => {
      await this.access.requireManager(input.chatId, input.actorId, transaction);
      if (!userIds.length) {
        return;
      }
      const [actor, users] = await Promise.all([
        this.users.findById(input.actorId, transaction),
        this.users.findByIds(userIds, transaction),
      ]);
      if (!actor || users.length !== userIds.length) {
        throw new ChatUserNotFoundError();
      }
      const activeMembers = await this.members.listByChat(input.chatId, transaction);
      const existingIds = new Set(
        activeMembers.flatMap((member) => (!member.leftAt && member.userId ? [member.userId] : [])),
      );
      const newUserCount = users.filter((user) => !existingIds.has(user.id)).length;
      if (existingIds.size + newUserCount > CHAT_LIMITS.maximumGroupParticipants) {
        throw new ChatValidationError();
      }
      let lastMessageAt: Date | null = null;
      for (const user of users) {
        if (existingIds.has(user.id)) {
          continue;
        }
        const now = this.clock.now();
        const created = await this.members.createIfAbsent(
          {
            id: this.ids.generate(),
            chatId: input.chatId,
            userId: user.id,
            memberName: user.name,
            role: 'member',
            joinedAt: now,
            lastReadAt: now,
          },
          transaction,
        );
        if (!created) {
          continue;
        }
        await this.messages.create(
          {
            id: this.ids.generate(),
            chatId: input.chatId,
            authorId: actor.id,
            authorName: actor.name,
            text: serializeSystemMessage({ key: 'memberAdded', actorName: actor.name, subjectName: user.name }),
            messageType: 'system',
            replyToMessageId: null,
            createdAt: now,
          },
          transaction,
        );
        lastMessageAt = now;
      }
      if (lastMessageAt) {
        await this.chats.updateLastMessageAt(input.chatId, lastMessageAt, transaction);
      }
    });
  }
}
