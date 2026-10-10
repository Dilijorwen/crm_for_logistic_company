/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Readable } from 'stream';
import { describe, expect, it, vi } from 'vitest';
import { InvalidFileLinkError, OpenStoredAttachment, StoredAttachmentNotFoundError } from '../OpenStoredAttachment';

function setup() {
  const attachments = {
    find: vi.fn().mockResolvedValue({ key: 'test.txt', fileName: 'test.txt', mimeType: 'text/plain' }),
  };
  const links = { verify: vi.fn().mockReturnValue(true) };
  const stream = Readable.from(['document']);
  const storage = { open: vi.fn().mockResolvedValue(stream) };
  return { attachments, links, storage, stream, action: new OpenStoredAttachment(attachments, links, storage) };
}

describe('OpenStoredAttachment', () => {
  it('opens a stored file only after verifying the capability', async () => {
    const test = setup();
    await expect(test.action.execute({ id: '1', expires: 123, signature: 'valid' })).resolves.toMatchObject({
      stream: test.stream,
    });
    expect(test.links.verify).toHaveBeenCalledWith('1', 123, 'valid');
    expect(test.storage.open).toHaveBeenCalledWith('test.txt');
  });

  it.each(['../secret', '', {}, null])('rejects an invalid identifier %s', async (id) => {
    const test = setup();
    await expect(test.action.execute({ id, expires: 123, signature: 'valid' })).rejects.toBeInstanceOf(
      InvalidFileLinkError,
    );
    expect(test.attachments.find).not.toHaveBeenCalled();
  });

  it('does not disclose metadata for an unauthorized request', async () => {
    const test = setup();
    test.links.verify.mockReturnValue(false);
    await expect(test.action.execute({ id: '1', expires: 123, signature: 'invalid' })).rejects.toBeInstanceOf(
      InvalidFileLinkError,
    );
    expect(test.attachments.find).not.toHaveBeenCalled();
  });

  it('reports a missing attachment', async () => {
    const test = setup();
    test.attachments.find.mockResolvedValue(null);
    await expect(test.action.execute({ id: '1', expires: 123, signature: 'valid' })).rejects.toBeInstanceOf(
      StoredAttachmentNotFoundError,
    );
    expect(test.storage.open).not.toHaveBeenCalled();
  });

  it('propagates a storage failure for safe HTTP mapping', async () => {
    const test = setup();
    test.storage.open.mockRejectedValue(new Error('storage failed'));
    await expect(test.action.execute({ id: '1', expires: 123, signature: 'valid' })).rejects.toThrow('storage failed');
  });
});
