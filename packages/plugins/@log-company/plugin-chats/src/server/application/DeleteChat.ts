/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ChatAccessService } from './ChatAccessService';
import { ChatAccessDeniedError } from '../domain/chat/ChatErrors';
import { canDeleteChat } from '../domain/chat/ChatPolicy';
import type { ChatRepository } from './ports/ChatRepository';
import type { TransactionManager } from './ports/TransactionManager';
import type { Clock } from './ports/Clock';

export class DeleteChat {
  constructor(
    private readonly access: ChatAccessService,
    private readonly chats: ChatRepository,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  async execute(chatId: string, actorId: string): Promise<void> {
    await this.transactions.execute(async (transaction) => {
      const { chat, member } = await this.access.requireActiveMember(chatId, actorId, transaction);
      if (!canDeleteChat(chat.type, member.role)) throw new ChatAccessDeniedError();
      await this.chats.softDelete(chatId, this.clock.now(), transaction);
    });
  }
}
