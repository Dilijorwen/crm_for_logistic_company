/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { attachmentPreviewKind } from '../attachmentPreview';

describe('chat attachment preview', () => {
  it.each([
    ['image/png', 'image'], ['image/jpeg', 'image'], ['image/avif', 'image'],
    ['application/pdf', 'document'], ['text/plain', 'document'], ['video/mp4', 'video'],
    ['video/webm', 'video'], ['audio/mpeg', 'audio'], ['audio/wav', 'audio'],
    ['image/svg+xml', null], ['text/html', null], ['application/octet-stream', null],
  ])('classifies %s without rendering active content', (mimeType, kind) => {
    expect(attachmentPreviewKind(mimeType)).toBe(kind);
  });
});
