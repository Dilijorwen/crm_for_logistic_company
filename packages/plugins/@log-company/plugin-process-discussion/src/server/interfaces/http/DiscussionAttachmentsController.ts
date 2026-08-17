/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Context, Next } from '@nocobase/actions';
import type { Plugin } from '@nocobase/server';
import type { DiscardPendingDiscussionAttachment } from '../../application/DiscardPendingDiscussionAttachment';
import type { DiscussionLogger } from '../../application/ports/DiscussionLogger';
import {
  DiscussionAttachmentError,
  type DiscussionAttachmentErrorCode,
} from '../../domain/attachments/DiscussionAttachmentErrors';

const RESOURCE = 'processDiscussionAttachments';
const NAMESPACE = '@log-company/plugin-process-discussion';

export class DiscussionAttachmentsController {
  constructor(
    private readonly plugin: Plugin,
    private readonly discardPendingAttachment: DiscardPendingDiscussionAttachment,
    private readonly logger: DiscussionLogger,
  ) {}

  register(): void {
    this.plugin.app.resourceManager.define({
      name: RESOURCE,
      actions: {
        discard: this.discard,
      },
    });
    this.plugin.app.acl.allow(RESOURCE, 'discard', 'loggedIn');
  }

  private readonly discard = async (context: Context, next: Next): Promise<void> => {
    await this.handle(context, async () => {
      const values = this.values(context);
      await this.discardPendingAttachment.execute({
        attachmentId: this.requiredIdentifier(values.attachmentId ?? values.id),
        actorId: this.actorId(context),
      });
      context.body = { deleted: true };
      await next();
    });
  };

  private actorId(context: Context): string {
    const actorId = this.optionalIdentifier(
      context.state?.currentUser?.id ?? context.state?.currentUserId ?? context.state?.user?.id,
    );
    if (!actorId) {
      throw new DiscussionAttachmentError('AUTHENTICATION_REQUIRED', 'Authentication required');
    }
    return actorId;
  }

  private requiredIdentifier(value: unknown): string {
    const identifier = this.optionalIdentifier(value);
    if (!identifier) {
      throw new DiscussionAttachmentError('INVALID_ATTACHMENT_ID', 'Invalid attachment identifier');
    }
    return identifier;
  }

  private optionalIdentifier(value: unknown): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const identifier = String(value);
    return /^\d+$/.test(identifier) && identifier !== '0' ? identifier : null;
  }

  private values(context: Context): Record<string, unknown> {
    const request = this.asRecord(context.request);
    return {
      ...this.asRecord(request.body),
      ...this.asRecord(context.action?.params?.values),
      ...this.asRecord(context.action?.params),
      ...this.asRecord(context.query),
    };
  }

  private async handle(context: Context, work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      if (error instanceof DiscussionAttachmentError) {
        context.throw(this.statusFor(error.code), context.t(this.translationKey(error.code), { ns: NAMESPACE }));
      }
      this.logger.error('Failed to discard a pending discussion attachment', error, {
        resource: String(context.action?.resourceName || ''),
        action: String(context.action?.actionName || ''),
      });
      context.throw(500, context.t('errors.internal', { ns: NAMESPACE }));
    }
  }

  private statusFor(code: DiscussionAttachmentErrorCode): number {
    if (code === 'AUTHENTICATION_REQUIRED') {
      return 401;
    }
    if (code === 'ATTACHMENT_DELETE_FORBIDDEN') {
      return 403;
    }
    if (code === 'ATTACHMENT_NOT_FOUND') {
      return 404;
    }
    if (code === 'ATTACHMENT_IN_USE') {
      return 409;
    }
    return 400;
  }

  private translationKey(code: DiscussionAttachmentErrorCode): string {
    const keys: Record<DiscussionAttachmentErrorCode, string> = {
      AUTHENTICATION_REQUIRED: 'errors.authenticationRequired',
      INVALID_ATTACHMENT_ID: 'errors.invalidAttachmentId',
      ATTACHMENT_NOT_FOUND: 'errors.attachmentNotFound',
      ATTACHMENT_DELETE_FORBIDDEN: 'errors.attachmentDeleteForbidden',
      ATTACHMENT_IN_USE: 'errors.attachmentInUse',
    };
    return keys[code];
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
