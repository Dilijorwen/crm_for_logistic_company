/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { normalizeMessageText } from '../domain/chat/ChatPolicy';
import { ChatStorageUploadError, ChatUserNotFoundError } from '../domain/chat/ChatErrors';
import { validateAttachment, validateAttachmentCount } from '../domain/attachments/AttachmentPolicy';
import { ChatAccessService } from './ChatAccessService';
import type { ChatMessageDto } from './dto/ChatDto';
import type { ChatAttachmentRecord, ChatAttachmentRepository } from './ports/ChatAttachmentRepository';
import type { ChatMessageRepository } from './ports/ChatMessageRepository';
import type { ChatRepository } from './ports/ChatRepository';
import type { ChatStorage } from './ports/ChatStorage';
import type { ChatLogger } from './ports/ChatLogger';
import type { Clock } from './ports/Clock';
import type { IdGenerator } from './ports/IdGenerator';
import type { TransactionManager } from './ports/TransactionManager';
import type { UserDirectory } from './ports/UserDirectory';

export interface UploadedChatFile {
  filePath: string;
  originalName: string;
  declaredMimeType: string;
  detectedMimeType: string;
  size: number;
}

export interface UploadChatAttachmentsInput {
  chatId: string;
  actorId: string;
  text: string | null;
  files: UploadedChatFile[];
}

interface PreparedFile extends UploadedChatFile {
  attachmentId: string;
  safeFileName: string;
  mimeType: string;
  temporaryKey: string;
  finalKey: string;
}

export class UploadChatAttachments {
  constructor(
    private readonly access: ChatAccessService,
    private readonly chats: ChatRepository,
    private readonly messages: ChatMessageRepository,
    private readonly attachments: ChatAttachmentRepository,
    private readonly users: UserDirectory,
    private readonly storage: ChatStorage,
    private readonly logger: ChatLogger,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: UploadChatAttachmentsInput): Promise<ChatMessageDto> {
    validateAttachmentCount(input.files.length);
    const text = normalizeMessageText(input.text, false);
    const actor = await this.users.findById(input.actorId);
    if (!actor) {
      throw new ChatUserNotFoundError();
    }
    await this.access.requireAvailableSender(input.chatId, input.actorId);
    const messageId = this.ids.generate();
    const prepared = input.files.map((file): PreparedFile => {
      const validated = validateAttachment(file);
      const attachmentId = this.ids.generate();
      const objectName = `${attachmentId}-${validated.safeFileName}`;
      return {
        ...file,
        ...validated,
        attachmentId,
        temporaryKey: `chats/tmp/${input.actorId}/${messageId}/${objectName}`,
        finalKey: `chats/${input.chatId}/${messageId}/${objectName}`,
      };
    });

    const temporaryKeys: string[] = [];
    const finalKeys: string[] = [];
    try {
      for (const file of prepared) {
        try {
          await this.storage.storeTemporary({
            key: file.temporaryKey,
            filePath: file.filePath,
            size: file.size,
            contentType: file.mimeType,
          });
          temporaryKeys.push(file.temporaryKey);
        } catch (error) {
          this.logger.error('chat_attachment_temporary_upload_failed', error, { chatId: input.chatId });
          throw new ChatStorageUploadError();
        }
      }

      const message = await this.transactions.execute(async (transaction) => {
        await this.access.requireAvailableSender(input.chatId, input.actorId, transaction);
        const now = this.clock.now();
        const created = await this.messages.create(
          {
            id: messageId,
            chatId: input.chatId,
            authorId: actor.id,
            authorName: actor.name,
            text,
            messageType: 'file',
            replyToMessageId: null,
            createdAt: now,
          },
          transaction,
        );
        const createdAttachments: ChatAttachmentRecord[] = [];
        for (const file of prepared) {
          createdAttachments.push(
            await this.attachments.create(
              {
                id: file.attachmentId,
                messageId,
                storageKey: file.finalKey,
                fileName: file.originalName,
                mimeType: file.mimeType,
                size: file.size,
                createdAt: now,
              },
              transaction,
            ),
          );
        }
        for (const file of prepared) {
          finalKeys.push(file.finalKey);
          try {
            await this.storage.promote(file.temporaryKey, file.finalKey);
          } catch (error) {
            this.logger.error('chat_attachment_promotion_failed', error, {
              chatId: input.chatId,
              messageId,
            });
            throw new ChatStorageUploadError();
          }
        }
        await this.chats.updateLastMessageAt(input.chatId, now, transaction);
        return {
          ...created,
          attachments: createdAttachments.map(({ id, fileName, mimeType, size }) => ({
            id,
            fileName,
            mimeType,
            size,
          })),
          canDelete: true,
        };
      });
      await this.deleteObjects(temporaryKeys);
      return message;
    } catch (error) {
      await this.deleteObjects([...temporaryKeys, ...finalKeys]);
      throw error;
    }
  }

  private async deleteObjects(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map(async (key) => {
        try {
          await this.storage.delete(key);
        } catch (error) {
          this.logger.warn('chat_attachment_compensation_failed', { key, error: String(error) });
        }
      }),
    );
  }
}
