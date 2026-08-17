/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { ChatMemberRepository } from './ports/ChatMemberRepository';
import type { ChatMessageRepository } from './ports/ChatMessageRepository';
import type { ChatRepository } from './ports/ChatRepository';
import type { Clock } from './ports/Clock';
import type { TransactionContext, TransactionManager } from './ports/TransactionManager';

export class HandleDeletedUser {
  constructor(
    private readonly chats: ChatRepository,
    private readonly members: ChatMemberRepository,
    private readonly messages: ChatMessageRepository,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  async execute(userId: string, existingTransaction?: TransactionContext): Promise<void> {
    await this.transactions.execute(async (transaction) => {
      const now = this.clock.now();
      await this.members.deactivateUser(userId, now, transaction);
      await this.messages.anonymizeUser(userId, transaction);
      await this.chats.anonymizeCreator(userId, transaction);
    }, existingTransaction);
  }
}
