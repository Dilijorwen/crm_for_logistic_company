/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import { DiscardPendingDiscussionAttachment } from '../application/DiscardPendingDiscussionAttachment';
import { EnsureDiscussionCascade } from '../application/EnsureDiscussionCascade';
import { NocoBaseDiscussionAttachmentRepository } from '../infrastructure/nocobase/NocoBaseDiscussionAttachmentRepository';
import { NocoBaseDiscussionCascadeGateway } from '../infrastructure/nocobase/NocoBaseDiscussionCascadeGateway';
import { NocoBaseDiscussionLogger } from '../infrastructure/nocobase/NocoBaseDiscussionLogger';
import { DiscussionAttachmentsController } from '../interfaces/http/DiscussionAttachmentsController';

import { WriteRunDiscussionComment } from '../application/WriteRunDiscussionComment';
import { NocoBaseRunDiscussion } from '../infrastructure/nocobase/NocoBaseRunDiscussion';
import { RunDiscussionController } from '../interfaces/http/RunDiscussionController';

export class ProcessDiscussionModule {
  constructor(private readonly plugin: Plugin) {}

  initialize(): void {
    const cascadeGateway = new NocoBaseDiscussionCascadeGateway(this.plugin);
    const attachments = new NocoBaseDiscussionAttachmentRepository(this.plugin);
    const runDiscussion = new NocoBaseRunDiscussion(this.plugin.db);
    new RunDiscussionController(
      this.plugin,
      runDiscussion,
      new WriteRunDiscussionComment(attachments, runDiscussion),
    ).register();
    const logger = new NocoBaseDiscussionLogger(this.plugin);

    new EnsureDiscussionCascade(cascadeGateway).execute();
    new DiscussionAttachmentsController(
      this.plugin,
      new DiscardPendingDiscussionAttachment(attachments),
      logger,
    ).register();
  }
}
