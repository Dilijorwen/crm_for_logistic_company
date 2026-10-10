/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { storageAreaPrefix, validateStorageKey } from '../StorageKey';
import { canPreviewInline } from '../PreviewPolicy';

describe('file storage boundaries', () => {
  it('isolates identical file names by application and feature', () => {
    expect(storageAreaPrefix('main', 'chat-attachments')).not.toBe(storageAreaPrefix('main', 'process-documents'));
    expect(storageAreaPrefix('main', 'attachments')).not.toBe(storageAreaPrefix('other', 'attachments'));
  });
  it.each(['../file', '/file', 'a/../file', 'a\\file', 'a\u0000b', ''])('rejects unsafe key %s', (key) => {
    expect(() => validateStorageKey(key)).toThrow();
  });
  it('allows generated keys and rejects unsafe namespaces', () => {
    expect(validateStorageKey('chats/12/34/photo.png')).toBe('chats/12/34/photo.png');
    expect(() => storageAreaPrefix('../other', 'attachments')).toThrow();
  });
  it('allows native browser types and never renders active content inline', () => {
    expect(canPreviewInline('application/pdf')).toBe(true);
    expect(canPreviewInline('image/jpeg')).toBe(true);
    expect(canPreviewInline('text/html')).toBe(false);
    expect(canPreviewInline('image/svg+xml')).toBe(false);
  });
});
