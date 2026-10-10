/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export type AttachmentPreviewKind = 'image' | 'video' | 'audio' | 'document' | null;

export function attachmentPreviewKind(mimeType: string): AttachmentPreviewKind {
  if (['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'].includes(mimeType)) return 'image';
  if (['video/mp4', 'video/webm'].includes(mimeType)) return 'video';
  if (['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4'].includes(mimeType)) return 'audio';
  if (['application/pdf', 'text/plain'].includes(mimeType)) return 'document';
  return null;
}
