/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export type ChatErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'VALIDATION_ERROR'
  | 'CHAT_NOT_FOUND'
  | 'CHAT_ACCESS_DENIED'
  | 'CHAT_MEMBER_NOT_FOUND'
  | 'CHAT_MEMBER_INACTIVE'
  | 'DIRECT_CHAT_WITH_SELF'
  | 'USER_NOT_FOUND'
  | 'GROUP_CHAT_REQUIRED'
  | 'MESSAGE_NOT_FOUND'
  | 'MESSAGE_DELETE_FORBIDDEN'
  | 'MESSAGE_ALREADY_DELETED'
  | 'CHAT_OWNER_REMOVAL_FORBIDDEN'
  | 'ATTACHMENT_NOT_FOUND'
  | 'ATTACHMENT_TOO_LARGE'
  | 'ATTACHMENT_TYPE_FORBIDDEN'
  | 'TOO_MANY_ATTACHMENTS'
  | 'UNAVAILABLE_DIRECT_CHAT'
  | 'STORAGE_UPLOAD_FAILED'
  | 'STORAGE_DOWNLOAD_FAILED';

export class ChatError extends Error {
  constructor(readonly code: ChatErrorCode) {
    super(code);
    this.name = new.target.name;
  }
}

export class ChatAuthenticationRequiredError extends ChatError {
  constructor() {
    super('AUTHENTICATION_REQUIRED');
  }
}

export class ChatValidationError extends ChatError {
  constructor() {
    super('VALIDATION_ERROR');
  }
}

export class ChatNotFoundError extends ChatError {
  constructor() {
    super('CHAT_NOT_FOUND');
  }
}

export class ChatAccessDeniedError extends ChatError {
  constructor() {
    super('CHAT_ACCESS_DENIED');
  }
}

export class ChatMemberNotFoundError extends ChatError {
  constructor() {
    super('CHAT_MEMBER_NOT_FOUND');
  }
}

export class ChatMemberInactiveError extends ChatError {
  constructor() {
    super('CHAT_MEMBER_INACTIVE');
  }
}

export class DirectChatWithSelfError extends ChatError {
  constructor() {
    super('DIRECT_CHAT_WITH_SELF');
  }
}

export class ChatUserNotFoundError extends ChatError {
  constructor() {
    super('USER_NOT_FOUND');
  }
}

export class GroupChatRequiredError extends ChatError {
  constructor() {
    super('GROUP_CHAT_REQUIRED');
  }
}

export class MessageNotFoundError extends ChatError {
  constructor() {
    super('MESSAGE_NOT_FOUND');
  }
}

export class MessageDeleteForbiddenError extends ChatError {
  constructor() {
    super('MESSAGE_DELETE_FORBIDDEN');
  }
}

export class MessageAlreadyDeletedError extends ChatError {
  constructor() {
    super('MESSAGE_ALREADY_DELETED');
  }
}

export class ChatOwnerRemovalForbiddenError extends ChatError {
  constructor() {
    super('CHAT_OWNER_REMOVAL_FORBIDDEN');
  }
}

export class AttachmentNotFoundError extends ChatError {
  constructor() {
    super('ATTACHMENT_NOT_FOUND');
  }
}

export class AttachmentTooLargeError extends ChatError {
  constructor() {
    super('ATTACHMENT_TOO_LARGE');
  }
}

export class AttachmentTypeForbiddenError extends ChatError {
  constructor() {
    super('ATTACHMENT_TYPE_FORBIDDEN');
  }
}

export class TooManyAttachmentsError extends ChatError {
  constructor() {
    super('TOO_MANY_ATTACHMENTS');
  }
}

export class UnavailableDirectChatError extends ChatError {
  constructor() {
    super('UNAVAILABLE_DIRECT_CHAT');
  }
}

export class ChatStorageUploadError extends ChatError {
  constructor() {
    super('STORAGE_UPLOAD_FAILED');
  }
}

export class ChatStorageDownloadError extends ChatError {
  constructor() {
    super('STORAGE_DOWNLOAD_FAILED');
  }
}
