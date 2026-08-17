/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ChatAccessService } from './ChatAccessService';
import type { ChatMemberRepository } from './ports/ChatMemberRepository';
import type { Clock } from './ports/Clock';
import type { TransactionManager } from './ports/TransactionManager';

export class MarkChatAsRead {
  constructor(
    private readonly access: ChatAccessService,
    private readonly members: ChatMemberRepository,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  async execute(chatId: string, actorId: string): Promise<void> {
    await this.transactions.execute(async (transaction) => {
      await this.access.requireActiveMember(chatId, actorId, transaction);
      await this.members.markRead(chatId, actorId, this.clock.now(), transaction);
    });
  }
}
