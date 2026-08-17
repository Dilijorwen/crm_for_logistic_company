/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { assertCanDeleteMessage } from '../domain/chat/ChatPolicy';
import { MessageNotFoundError } from '../domain/chat/ChatErrors';
import { ChatAccessService } from './ChatAccessService';
import type { ChatMessageRepository } from './ports/ChatMessageRepository';
import type { Clock } from './ports/Clock';
import type { TransactionManager } from './ports/TransactionManager';

export class DeleteChatMessage {
  constructor(
    private readonly access: ChatAccessService,
    private readonly messages: ChatMessageRepository,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  async execute(messageId: string, actorId: string): Promise<void> {
    await this.transactions.execute(async (transaction) => {
      const message = await this.messages.findById(messageId, transaction);
      if (!message) {
        throw new MessageNotFoundError();
      }
      await this.access.requireActiveMember(message.chatId, actorId, transaction);
      assertCanDeleteMessage(message.authorId, actorId, message.deletedAt);
      await this.messages.softDelete(messageId, actorId, this.clock.now(), transaction);
    });
  }
}
