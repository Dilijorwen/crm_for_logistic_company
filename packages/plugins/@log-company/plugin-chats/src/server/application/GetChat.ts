/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ChatNotFoundError } from '../domain/chat/ChatErrors';
import { ChatAccessService } from './ChatAccessService';
import type { ChatDetailsDto } from './dto/ChatDto';
import type { ChatMemberRepository } from './ports/ChatMemberRepository';
import type { ChatRepository } from './ports/ChatRepository';

export class GetChat {
  constructor(
    private readonly access: ChatAccessService,
    private readonly chats: ChatRepository,
    private readonly members: ChatMemberRepository,
  ) {}

  async execute(chatId: string, actorId: string): Promise<ChatDetailsDto> {
    const { member } = await this.access.requireActiveMember(chatId, actorId);
    const [item, members] = await Promise.all([
      this.chats.getListItem(chatId, actorId),
      this.members.listByChat(chatId),
    ]);
    if (!item) {
      throw new ChatNotFoundError();
    }
    return {
      ...item,
      members,
      currentRole: member.role,
      canManageMembers: member.role === 'owner' || member.role === 'admin',
    };
  }
}
