/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export type DiscussionAttachmentErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'INVALID_ATTACHMENT_ID'
  | 'ATTACHMENT_NOT_FOUND'
  | 'ATTACHMENT_DELETE_FORBIDDEN'
  | 'ATTACHMENT_IN_USE';

export class DiscussionAttachmentError extends Error {
  constructor(
    readonly code: DiscussionAttachmentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DiscussionAttachmentError';
  }
}
