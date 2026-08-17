/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Context } from '@nocobase/actions';
import type { ChatLogger } from '../../application/ports/ChatLogger';
import {
  AttachmentTooLargeError,
  ChatAuthenticationRequiredError,
  ChatError,
  ChatValidationError,
  TooManyAttachmentsError,
} from '../../domain/chat/ChatErrors';

const NAMESPACE = '@log-company/plugin-chats';

export class ChatHttpSupport {
  constructor(private readonly logger: ChatLogger) {}

  actorId(context: Context): string {
    const value = context.state?.currentUser?.id ?? context.state?.currentUserId ?? context.state?.user?.id;
    const id = this.optionalId(value);
    if (!id) {
      throw new ChatAuthenticationRequiredError();
    }
    return id;
  }

  values(context: Context): Record<string, unknown> {
    const request = this.asRecord(context.request);
    return {
      ...this.asRecord(request.body),
      ...this.asRecord(context.action?.params?.values),
      ...this.asRecord(context.action?.params),
      ...this.asRecord(context.query),
    };
  }

  requiredId(value: unknown): string {
    const id = this.optionalId(value);
    if (!id) {
      throw new ChatValidationError();
    }
    return id;
  }

  optionalId(value: unknown): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const id = String(value);
    return /^\d+$/.test(id) && id !== '0' ? id : null;
  }

  identifierArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      throw new ChatValidationError();
    }
    return value.map((item) => this.requiredId(item));
  }

  requiredString(value: unknown): string {
    if (typeof value !== 'string') {
      throw new ChatValidationError();
    }
    return value;
  }

  integer(value: unknown, fallback: number): number {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
      throw new ChatValidationError();
    }
    return parsed;
  }

  async handle(context: Context, work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (caughtError) {
      let error: unknown = caughtError;
      const uploadCode = this.errorCode(error);
      if (uploadCode === 'LIMIT_FILE_SIZE') {
        error = new AttachmentTooLargeError();
      } else if (uploadCode === 'LIMIT_FILE_COUNT' || uploadCode === 'LIMIT_UNEXPECTED_FILE') {
        error = new TooManyAttachmentsError();
      }
      if (error instanceof ChatError) {
        context.throw(this.statusFor(error), context.t(`errors.${error.code}`, { ns: NAMESPACE }));
      }
      this.logger.error('chat_request_failed', error, {
        resource: String(context.action?.resourceName || ''),
        action: String(context.action?.actionName || ''),
      });
      context.throw(500, context.t('errors.internal', { ns: NAMESPACE }));
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private statusFor(error: ChatError): number {
    if (error.code === 'AUTHENTICATION_REQUIRED') return 401;
    if (['CHAT_ACCESS_DENIED', 'CHAT_MEMBER_INACTIVE', 'MESSAGE_DELETE_FORBIDDEN'].includes(error.code)) return 403;
    if (
      [
        'CHAT_NOT_FOUND',
        'CHAT_MEMBER_NOT_FOUND',
        'USER_NOT_FOUND',
        'MESSAGE_NOT_FOUND',
        'ATTACHMENT_NOT_FOUND',
      ].includes(error.code)
    ) {
      return 404;
    }
    if (['MESSAGE_ALREADY_DELETED', 'CHAT_OWNER_REMOVAL_FORBIDDEN'].includes(error.code)) return 409;
    if (error.code === 'ATTACHMENT_TOO_LARGE') return 413;
    if (['STORAGE_UPLOAD_FAILED', 'STORAGE_DOWNLOAD_FAILED'].includes(error.code)) return 502;
    if (
      [
        'DIRECT_CHAT_WITH_SELF',
        'GROUP_CHAT_REQUIRED',
        'UNAVAILABLE_DIRECT_CHAT',
        'ATTACHMENT_TYPE_FORBIDDEN',
        'TOO_MANY_ATTACHMENTS',
      ].includes(error.code)
    ) {
      return 422;
    }
    return 400;
  }

  private errorCode(error: unknown): string | null {
    if (error === null || typeof error !== 'object' || Array.isArray(error)) {
      return null;
    }
    const code = (error as Record<string, unknown>).code;
    return typeof code === 'string' ? code : null;
  }
}
