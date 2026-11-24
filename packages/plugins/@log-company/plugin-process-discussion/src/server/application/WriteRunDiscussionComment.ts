/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { PROCESS_DISCUSSION_ATTACHMENT_PURPOSE } from '../../shared/processDiscussionAttachments';
import type {
  DiscussionAttachmentRepository,
  DiscussionAttachmentTransaction,
} from './ports/DiscussionAttachmentRepository';

export interface RunDiscussionCommentInput {
  runId: string;
  actorId: string;
  text: string;
  attachmentIds: string[];
}

interface RunDiscussionCommentRepository {
  create(input: RunDiscussionCommentInput, transaction: DiscussionAttachmentTransaction): Promise<void>;
}

export class RunDiscussionAttachmentDenied extends Error {}

export class WriteRunDiscussionComment {
  constructor(
    private readonly attachments: DiscussionAttachmentRepository,
    private readonly comments: RunDiscussionCommentRepository,
  ) {}

  async execute(input: RunDiscussionCommentInput): Promise<void> {
    await this.attachments.withTransaction(async (transaction) => {
      for (const id of [...input.attachmentIds].sort()) {
        const attachment = await this.attachments.findById(id, transaction);
        if (
          attachment?.createdById !== input.actorId ||
          attachment.purpose !== PROCESS_DISCUSSION_ATTACHMENT_PURPOSE ||
          (await this.attachments.isReferenced(id, transaction))
        ) {
          throw new RunDiscussionAttachmentDenied();
        }
      }
      await this.comments.create(input, transaction);
    });
  }
}
