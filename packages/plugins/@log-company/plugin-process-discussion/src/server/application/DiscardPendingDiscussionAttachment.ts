/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { PROCESS_DISCUSSION_ATTACHMENT_PURPOSE } from '../../shared/processDiscussionAttachments';
import { DiscussionAttachmentError } from '../domain/attachments/DiscussionAttachmentErrors';
import type { DiscussionAttachmentRepository } from './ports/DiscussionAttachmentRepository';

export interface DiscardPendingDiscussionAttachmentInput {
  attachmentId: string;
  actorId: string;
}

export class DiscardPendingDiscussionAttachment {
  constructor(private readonly attachments: DiscussionAttachmentRepository) {}

  async execute(input: DiscardPendingDiscussionAttachmentInput): Promise<void> {
    await this.attachments.withTransaction(async (transaction) => {
      const attachment = await this.attachments.findById(input.attachmentId, transaction);
      if (!attachment) {
        throw new DiscussionAttachmentError('ATTACHMENT_NOT_FOUND', 'Attachment not found');
      }
      if (attachment.createdById !== input.actorId || attachment.purpose !== PROCESS_DISCUSSION_ATTACHMENT_PURPOSE) {
        throw new DiscussionAttachmentError('ATTACHMENT_DELETE_FORBIDDEN', 'Attachment deletion is forbidden');
      }
      if (await this.attachments.isReferenced(attachment.id, transaction)) {
        throw new DiscussionAttachmentError('ATTACHMENT_IN_USE', 'Attachment is already in use');
      }
      await this.attachments.deleteById(attachment.id, transaction);
    });
  }
}
