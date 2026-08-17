/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createDirectChatKey } from '../domain/chat/ChatPolicy';
import { ChatUserNotFoundError } from '../domain/chat/ChatErrors';
import type { ChatListItemDto } from './dto/ChatDto';
import type { ChatMemberRepository } from './ports/ChatMemberRepository';
import type { ChatRepository } from './ports/ChatRepository';
import type { Clock } from './ports/Clock';
import type { IdGenerator } from './ports/IdGenerator';
import type { TransactionManager } from './ports/TransactionManager';
import type { UserDirectory } from './ports/UserDirectory';

export interface CreateDirectChatInput {
  actorId: string;
  otherUserId: string;
}

export class CreateDirectChat {
  constructor(
    private readonly chats: ChatRepository,
    private readonly members: ChatMemberRepository,
    private readonly users: UserDirectory,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateDirectChatInput): Promise<ChatListItemDto> {
    const directKey = createDirectChatKey(input.actorId, input.otherUserId);
    const users = await this.users.findByIds([input.actorId, input.otherUserId]);
    const actor = users.find((user) => user.id === input.actorId);
    const otherUser = users.find((user) => user.id === input.otherUserId);
    if (!actor || !otherUser) {
      throw new ChatUserNotFoundError();
    }

    const existing = await this.chats.findByDirectKey(directKey);
    if (existing) {
      const item = await this.chats.getListItem(existing.id, input.actorId);
      if (item) {
        return item;
      }
    }

    const chatId = await this.transactions.execute(async (transaction) => {
      const now = this.clock.now();
      const created = await this.chats.createDirectIfAbsent(
        {
          id: this.ids.generate(),
          type: 'direct',
          title: null,
          directKey,
          createdById: input.actorId,
          now,
        },
        transaction,
      );
      if (!created) {
        const concurrent = await this.chats.findByDirectKey(directKey, transaction);
        if (!concurrent) {
          throw new ChatUserNotFoundError();
        }
        return concurrent.id;
      }
      await this.members.create(
        {
          id: this.ids.generate(),
          chatId: created.id,
          userId: actor.id,
          memberName: actor.name,
          role: 'member',
          joinedAt: now,
          lastReadAt: now,
        },
        transaction,
      );
      await this.members.create(
        {
          id: this.ids.generate(),
          chatId: created.id,
          userId: otherUser.id,
          memberName: otherUser.name,
          role: 'member',
          joinedAt: now,
          lastReadAt: now,
        },
        transaction,
      );
      return created.id;
    });

    const result = await this.chats.getListItem(chatId, input.actorId);
    if (!result) {
      throw new ChatUserNotFoundError();
    }
    return result;
  }
}
