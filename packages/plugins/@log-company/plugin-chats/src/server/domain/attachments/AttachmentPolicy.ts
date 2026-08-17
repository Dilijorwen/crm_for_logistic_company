/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  CHAT_LIMITS,
  type AllowedAttachmentExtension,
} from '../../../shared/chatLimits';
import {
  AttachmentTooLargeError,
  AttachmentTypeForbiddenError,
  ChatValidationError,
  TooManyAttachmentsError,
} from '../chat/ChatErrors';

const allowedExtensions = new Set<string>(ALLOWED_ATTACHMENT_EXTENSIONS);

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}

const mimeTypesByExtension: Record<AllowedAttachmentExtension, readonly string[]> = {
  csv: ['text/csv', 'text/plain'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  gif: ['image/gif'],
  jpeg: ['image/jpeg'],
  jpg: ['image/jpeg'],
  pdf: ['application/pdf'],
  png: ['image/png'],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  txt: ['text/plain'],
  webp: ['image/webp'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};

export interface AttachmentCandidate {
  originalName: string;
  declaredMimeType: string;
  detectedMimeType: string;
  size: number;
}

export function validateAttachmentCount(count: number): void {
  if (count < 1) {
    throw new ChatValidationError();
  }
  if (count > CHAT_LIMITS.maximumAttachmentsPerMessage) {
    throw new TooManyAttachmentsError();
  }
}

export function validateAttachment(candidate: AttachmentCandidate): { safeFileName: string; mimeType: string } {
  if (!Number.isSafeInteger(candidate.size) || candidate.size < 1) {
    throw new ChatValidationError();
  }
  if (candidate.size > CHAT_LIMITS.maximumAttachmentSizeBytes) {
    throw new AttachmentTooLargeError();
  }

  const baseName = candidate.originalName.trim();
  if (
    !baseName ||
    baseName !== candidate.originalName ||
    containsControlCharacter(baseName) ||
    baseName.includes('/') ||
    baseName.includes('\\') ||
    baseName.length > CHAT_LIMITS.maximumAttachmentFileNameLength
  ) {
    throw new AttachmentTypeForbiddenError();
  }
  const extensionSeparator = baseName.lastIndexOf('.');
  const extension = extensionSeparator > 0 ? baseName.slice(extensionSeparator + 1).toLowerCase() : '';
  if (!allowedExtensions.has(extension)) {
    throw new AttachmentTypeForbiddenError();
  }

  const allowedMimeTypes = mimeTypesByExtension[extension as AllowedAttachmentExtension];
  if (
    !allowedMimeTypes.includes(candidate.declaredMimeType.toLowerCase()) ||
    !allowedMimeTypes.includes(candidate.detectedMimeType.toLowerCase())
  ) {
    throw new AttachmentTypeForbiddenError();
  }

  const safeFileName = baseName
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._ -]+/gu, '_')
    .replace(/\s+/g, ' ')
    .slice(0, CHAT_LIMITS.maximumAttachmentFileNameLength);
  if (!safeFileName || safeFileName.startsWith('.')) {
    throw new AttachmentTypeForbiddenError();
  }
  return { safeFileName, mimeType: candidate.detectedMimeType.toLowerCase() };
}
