/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export const CHAT_LIMITS = {
  maximumAttachmentsPerMessage: 10,
  maximumAttachmentSizeBytes: 25 * 1024 * 1024,
  maximumMessageLength: 10_000,
  maximumGroupTitleLength: 160,
  maximumGroupParticipants: 100,
  maximumAttachmentFileNameLength: 180,
  maximumUserSearchQueryLength: 100,
  userSearchResultLimit: 30,
  defaultMessagePageSize: 50,
  maximumMessagePageSize: 100,
  pollingIntervalMilliseconds: 12_000,
} as const;

export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  'csv',
  'doc',
  'docx',
  'gif',
  'jpeg',
  'jpg',
  'pdf',
  'png',
  'ppt',
  'pptx',
  'txt',
  'webp',
  'xls',
  'xlsx',
] as const;

export type AllowedAttachmentExtension = (typeof ALLOWED_ATTACHMENT_EXTENSIONS)[number];
