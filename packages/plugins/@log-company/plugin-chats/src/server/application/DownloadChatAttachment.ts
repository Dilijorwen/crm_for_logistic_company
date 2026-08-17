/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { AttachmentNotFoundError, ChatStorageDownloadError, MessageNotFoundError } from '../domain/chat/ChatErrors';
import { ChatAccessService } from './ChatAccessService';
import type { ChatAttachmentRepository } from './ports/ChatAttachmentRepository';
import type { ChatLogger } from './ports/ChatLogger';
import type { ChatMessageRepository } from './ports/ChatMessageRepository';
import type { ChatStorage } from './ports/ChatStorage';

export interface DownloadChatAttachmentResult {
  content: unknown;
  fileName: string;
  mimeType: string;
  size: number;
}

export class DownloadChatAttachment {
  constructor(
    private readonly access: ChatAccessService,
    private readonly attachments: ChatAttachmentRepository,
    private readonly messages: ChatMessageRepository,
    private readonly storage: ChatStorage,
    private readonly logger: ChatLogger,
  ) {}

  async execute(attachmentId: string, actorId: string): Promise<DownloadChatAttachmentResult> {
    const attachment = await this.attachments.findById(attachmentId);
    if (!attachment) {
      throw new AttachmentNotFoundError();
    }
    const message = await this.messages.findById(attachment.messageId);
    if (!message || message.deletedAt) {
      throw new MessageNotFoundError();
    }
    await this.access.requireActiveMember(message.chatId, actorId);
    try {
      return {
        content: await this.storage.open(attachment.storageKey),
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size,
      };
    } catch (error) {
      this.logger.error('chat_attachment_download_failed', error, { attachmentId, actorId });
      throw new ChatStorageDownloadError();
    }
  }
}
