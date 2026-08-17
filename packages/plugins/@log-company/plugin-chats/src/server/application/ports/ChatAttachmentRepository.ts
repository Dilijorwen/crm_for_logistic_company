/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { ChatAttachmentDto } from '../dto/ChatDto';
import type { TransactionContext } from './TransactionManager';

export interface ChatAttachmentRecord extends ChatAttachmentDto {
  messageId: string;
  storageKey: string;
  createdAt: Date | string;
}

export interface CreateChatAttachmentInput {
  id: string;
  messageId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}

export interface ChatAttachmentRepository {
  create(input: CreateChatAttachmentInput, transaction: TransactionContext): Promise<ChatAttachmentRecord>;
  findById(attachmentId: string, transaction?: TransactionContext): Promise<ChatAttachmentRecord | null>;
  listByMessageIds(messageIds: string[]): Promise<Map<string, ChatAttachmentDto[]>>;
}
