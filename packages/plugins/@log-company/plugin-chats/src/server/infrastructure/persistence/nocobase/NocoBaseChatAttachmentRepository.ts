/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import type { ChatAttachmentDto } from '../../../application/dto/ChatDto';
import type {
  ChatAttachmentRecord,
  ChatAttachmentRepository,
  CreateChatAttachmentInput,
} from '../../../application/ports/ChatAttachmentRepository';
import type { TransactionContext } from '../../../application/ports/TransactionManager';
import { NocoBaseTransactionManager } from '../../nocobase/NocoBaseTransactionManager';

interface AttachmentRow {
  id: string | number | bigint;
  message_id: string | number | bigint;
  storage_key: string;
  file_name: string;
  mime_type: string;
  size: string | number | bigint;
  created_at: Date | string;
}

export class NocoBaseChatAttachmentRepository implements ChatAttachmentRepository {
  constructor(private readonly plugin: Plugin) {}

  async create(input: CreateChatAttachmentInput, transaction: TransactionContext): Promise<ChatAttachmentRecord> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        insert into chat_message_attachments
          (id, message_id, storage_key, file_name, mime_type, size, created_at)
        values
          (:id, :messageId, :storageKey, :fileName, :mimeType, :size, :createdAt)
        returning *
      `,
      {
        replacements: { ...input },
        transaction: NocoBaseTransactionManager.asTransaction(transaction),
      },
    )) as unknown as [AttachmentRow[], unknown];
    return this.mapAttachment(rows[0]);
  }

  async findById(attachmentId: string, transaction?: TransactionContext): Promise<ChatAttachmentRecord | null> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `select * from chat_message_attachments where id = :attachmentId limit 1`,
      {
        replacements: { attachmentId },
        transaction: NocoBaseTransactionManager.asTransaction(transaction),
      },
    )) as unknown as [AttachmentRow[], unknown];
    return rows[0] ? this.mapAttachment(rows[0]) : null;
  }

  async listByMessageIds(messageIds: string[]): Promise<Map<string, ChatAttachmentDto[]>> {
    const result = new Map<string, ChatAttachmentDto[]>();
    if (!messageIds.length) {
      return result;
    }
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        select attachment.*
        from chat_message_attachments attachment
        join chat_messages message on message.id = attachment.message_id and message.deleted_at is null
        where attachment.message_id in (:messageIds)
        order by attachment.created_at asc, attachment.id asc
      `,
      { replacements: { messageIds } },
    )) as unknown as [AttachmentRow[], unknown];
    for (const row of rows) {
      const attachment = this.mapAttachment(row);
      const current = result.get(attachment.messageId) || [];
      current.push({
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size,
      });
      result.set(attachment.messageId, current);
    }
    return result;
  }

  private mapAttachment(row: AttachmentRow): ChatAttachmentRecord {
    return {
      id: String(row.id),
      messageId: String(row.message_id),
      storageKey: row.storage_key,
      fileName: row.file_name,
      mimeType: row.mime_type,
      size: Number(row.size),
      createdAt: row.created_at,
    };
  }
}
