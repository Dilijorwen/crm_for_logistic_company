/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { AttachmentTooLargeError, AttachmentTypeForbiddenError, TooManyAttachmentsError } from '../../chat/ChatErrors';
import { CHAT_LIMITS } from '../../../../shared/chatLimits';
import { validateAttachment, validateAttachmentCount } from '../AttachmentPolicy';

describe('AttachmentPolicy', () => {
  it('accepts an allowed file with matching declared and detected MIME types', () => {
    expect(
      validateAttachment({
        originalName: 'Договор 2026.pdf',
        declaredMimeType: 'application/pdf',
        detectedMimeType: 'application/pdf',
        size: 1024,
      }),
    ).toEqual({ safeFileName: 'Договор 2026.pdf', mimeType: 'application/pdf' });
  });

  it('rejects path traversal in a filename', () => {
    expect(() =>
      validateAttachment({
        originalName: '../contract.pdf',
        declaredMimeType: 'application/pdf',
        detectedMimeType: 'application/pdf',
        size: 1024,
      }),
    ).toThrow(AttachmentTypeForbiddenError);
  });

  it('rejects executable extensions', () => {
    expect(() =>
      validateAttachment({
        originalName: 'invoice.exe',
        declaredMimeType: 'application/octet-stream',
        detectedMimeType: 'application/octet-stream',
        size: 1024,
      }),
    ).toThrow(AttachmentTypeForbiddenError);
  });

  it('does not trust a declared MIME type that differs from file contents', () => {
    expect(() =>
      validateAttachment({
        originalName: 'image.png',
        declaredMimeType: 'image/png',
        detectedMimeType: 'application/octet-stream',
        size: 1024,
      }),
    ).toThrow(AttachmentTypeForbiddenError);
  });

  it('enforces the per-file limit', () => {
    expect(() =>
      validateAttachment({
        originalName: 'large.pdf',
        declaredMimeType: 'application/pdf',
        detectedMimeType: 'application/pdf',
        size: CHAT_LIMITS.maximumAttachmentSizeBytes + 1,
      }),
    ).toThrow(AttachmentTooLargeError);
  });

  it('enforces the attachment count limit', () => {
    expect(() => validateAttachmentCount(CHAT_LIMITS.maximumAttachmentsPerMessage + 1)).toThrow(
      TooManyAttachmentsError,
    );
  });
});
