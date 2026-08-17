/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { CHAT_LIMITS } from '../../shared/chatLimits';
import { ChatValidationError } from '../domain/chat/ChatErrors';
import { ChatAccessService } from './ChatAccessService';
import { decodeMessageCursor, encodeMessageCursor } from './MessageCursorCodec';
import type { MessagePageDto } from './dto/ChatDto';
import type { ChatAttachmentRepository } from './ports/ChatAttachmentRepository';
import type { ChatMessageRepository } from './ports/ChatMessageRepository';

export interface GetChatMessagesInput {
  chatId: string;
  actorId: string;
  cursor: string | null;
  beforeId: string | null;
  limit: number;
}

export class GetChatMessages {
  constructor(
    private readonly access: ChatAccessService,
    private readonly messages: ChatMessageRepository,
    private readonly attachments: ChatAttachmentRepository,
  ) {}

  async execute(input: GetChatMessagesInput): Promise<MessagePageDto> {
    await this.access.requireActiveMember(input.chatId, input.actorId);
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > CHAT_LIMITS.maximumMessagePageSize) {
      throw new ChatValidationError();
    }
    let cursor = decodeMessageCursor(input.cursor);
    if (!cursor && input.beforeId) {
      const message = await this.messages.findById(input.beforeId);
      if (!message || message.chatId !== input.chatId) {
        throw new ChatValidationError();
      }
      cursor = { createdAt: new Date(message.createdAt).toISOString(), id: message.id };
    }
    const rows = await this.messages.list(input.chatId, cursor, input.limit + 1, input.actorId);
    const hasMore = rows.length > input.limit;
    const items = hasMore ? rows.slice(0, input.limit) : rows;
    const attachmentMap = await this.attachments.listByMessageIds(items.map((message) => message.id));
    const hydrated = items.map((message) => ({
      ...message,
      attachments: message.deletedAt ? [] : attachmentMap.get(message.id) || [],
    }));
    const oldest = hydrated[hydrated.length - 1];
    return {
      items: hydrated,
      nextCursor:
        hasMore && oldest
          ? encodeMessageCursor({ createdAt: new Date(oldest.createdAt).toISOString(), id: oldest.id })
          : null,
    };
  }
}
