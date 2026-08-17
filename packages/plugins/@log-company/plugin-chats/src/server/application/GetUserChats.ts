/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { ChatListItemDto } from './dto/ChatDto';
import type { ChatRepository } from './ports/ChatRepository';

export class GetUserChats {
  constructor(private readonly chats: ChatRepository) {}

  execute(actorId: string): Promise<ChatListItemDto[]> {
    return this.chats.listForUser(actorId);
  }
}
