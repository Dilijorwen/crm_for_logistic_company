/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { CHAT_LIMITS } from '../../shared/chatLimits';
import { normalizeGroupTitle } from '../domain/chat/ChatPolicy';
import { ChatUserNotFoundError, ChatValidationError } from '../domain/chat/ChatErrors';
import type { ChatListItemDto } from './dto/ChatDto';
import type { ChatMemberRepository } from './ports/ChatMemberRepository';
import type { ChatRepository } from './ports/ChatRepository';
import type { Clock } from './ports/Clock';
import type { IdGenerator } from './ports/IdGenerator';
import type { TransactionManager } from './ports/TransactionManager';
import type { UserDirectory } from './ports/UserDirectory';

export interface CreateGroupChatInput {
  actorId: string;
  title: string;
  memberUserIds: string[];
}

export class CreateGroupChat {
  constructor(
    private readonly chats: ChatRepository,
    private readonly members: ChatMemberRepository,
    private readonly users: UserDirectory,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateGroupChatInput): Promise<ChatListItemDto> {
    const title = normalizeGroupTitle(input.title);
    const selectedUserIds = Array.from(new Set(input.memberUserIds)).filter((userId) => userId !== input.actorId);
    if (!selectedUserIds.length || selectedUserIds.length + 1 > CHAT_LIMITS.maximumGroupParticipants) {
      throw new ChatValidationError();
    }
    const memberUserIds = [input.actorId, ...selectedUserIds];
    const users = await this.users.findByIds(memberUserIds);
    if (users.length !== memberUserIds.length) {
      throw new ChatUserNotFoundError();
    }
    const userById = new Map(users.map((user) => [user.id, user]));

    const chat = await this.transactions.execute(async (transaction) => {
      const now = this.clock.now();
      const created = await this.chats.create(
        {
          id: this.ids.generate(),
          type: 'group',
          title,
          directKey: null,
          createdById: input.actorId,
          now,
        },
        transaction,
      );
      for (const userId of memberUserIds) {
        const user = userById.get(userId);
        if (!user) {
          throw new ChatUserNotFoundError();
        }
        await this.members.create(
          {
            id: this.ids.generate(),
            chatId: created.id,
            userId,
            memberName: user.name,
            role: userId === input.actorId ? 'owner' : 'member',
            joinedAt: now,
            lastReadAt: now,
          },
          transaction,
        );
      }
      return created;
    });

    const result = await this.chats.getListItem(chat.id, input.actorId);
    if (!result) {
      throw new ChatUserNotFoundError();
    }
    return result;
  }
}
