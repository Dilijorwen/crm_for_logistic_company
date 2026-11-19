/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { canPreviewInline } from '../domain/PreviewPolicy';
import { isControlCharacter } from '../domain/UploadPolicy';

export function fileResponseHeaders(input: {
  fileName: string;
  mimeType: string;
  size?: number;
  preview?: boolean;
}): Record<string, string> {
  const disposition = input.preview && canPreviewInline(input.mimeType) ? 'inline' : 'attachment';
  const mimeType = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(input.mimeType) ? input.mimeType : 'application/octet-stream';
  const safeName = Array.from(input.fileName, (character) =>
    isControlCharacter(character) || character === '/' || character === '\\' ? '_' : character,
  ).join('');
  const filename = encodeURIComponent(safeName).replace(
    /['()*]/g,
    (character) => '%' + character.charCodeAt(0).toString(16).toUpperCase(),
  );
  return {
    'Content-Type': mimeType,
    'Content-Disposition': `${disposition}; filename*=UTF-8''${filename}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': "sandbox; default-src 'none'",
    ...(input.size === undefined ? {} : { 'Content-Length': String(input.size) }),
  };
}
