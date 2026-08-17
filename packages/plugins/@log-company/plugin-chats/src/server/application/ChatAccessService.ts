/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { assertCanManageMembers } from '../domain/chat/ChatPolicy';
import {
  ChatAccessDeniedError,
  ChatMemberInactiveError,
  ChatNotFoundError,
  GroupChatRequiredError,
  UnavailableDirectChatError,
} from '../domain/chat/ChatErrors';
import type { ChatMemberDto, ChatRecord } from './dto/ChatDto';
import type { ChatMemberRepository } from './ports/ChatMemberRepository';
import type { ChatRepository } from './ports/ChatRepository';
import type { TransactionContext } from './ports/TransactionManager';

export interface ChatAccessResult {
  chat: ChatRecord;
  member: ChatMemberDto;
}

export class ChatAccessService {
  constructor(
    private readonly chats: ChatRepository,
    private readonly members: ChatMemberRepository,
  ) {}

  async requireActiveMember(
    chatId: string,
    actorId: string,
    transaction?: TransactionContext,
  ): Promise<ChatAccessResult> {
    const chat = await this.chats.findById(chatId, transaction);
    if (!chat || chat.deletedAt) {
      throw new ChatNotFoundError();
    }
    const membership = await this.members.findMembership(chatId, actorId, transaction);
    if (!membership) {
      throw new ChatAccessDeniedError();
    }
    if (membership.leftAt || membership.deleted) {
      throw new ChatMemberInactiveError();
    }
    return { chat, member: membership };
  }

  async requireManager(chatId: string, actorId: string, transaction?: TransactionContext): Promise<ChatAccessResult> {
    const access = await this.requireActiveMember(chatId, actorId, transaction);
    if (access.chat.type !== 'group') {
      throw new GroupChatRequiredError();
    }
    assertCanManageMembers(access.member.role);
    return access;
  }

  async requireAvailableSender(
    chatId: string,
    actorId: string,
    transaction?: TransactionContext,
  ): Promise<ChatAccessResult> {
    const access = await this.requireActiveMember(chatId, actorId, transaction);
    if (access.chat.type === 'direct' && !(await this.members.isDirectChatAvailable(chatId, transaction))) {
      throw new UnavailableDirectChatError();
    }
    return access;
  }
}
