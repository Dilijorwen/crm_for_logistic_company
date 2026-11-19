/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Context } from '@nocobase/actions';
import { describe, expect, it, vi } from 'vitest';
import type { FileDeletionQueue } from '../FileDeletionQueue';
import { NativeUploadRollback } from '../PrivateMinioStorageType';

function fixture() {
  const enqueue = vi.fn().mockResolvedValue(undefined);
  const findOne = vi.fn().mockResolvedValue(null);
  const rollback = new NativeUploadRollback({ enqueue } as unknown as FileDeletionQueue, vi.fn());
  const context = {
    req: {},
    action: { resourceName: 'attachments' },
    db: { getRepository: () => ({ findOne }) },
    throw: (status: number, message: string) => {
      throw Object.assign(new Error(message), { status });
    },
  } as unknown as Context;
  const values: Record<string, unknown> = { filename: 'new.pdf', storageId: 7, path: '', mimetype: 'application/pdf' };
  const record = {
    isNewRecord: true,
    get: (key: string) => values[key],
    previous: () => undefined,
    changed: () => true,
  };
  const upload = { key: 'new.pdf', filename: 'new.pdf', storageId: 7, mimeType: 'application/pdf' };
  return { enqueue, findOne, rollback, context, record, upload, values };
}

describe('native private attachment handling', () => {
  it('only binds keys and MIME types produced by the current request upload', () => {
    const { rollback, context, record, upload, values } = fixture();
    const isPrivate = (id: unknown) => id === 7;
    expect(() => rollback.assertBinding(record, context, isPrivate)).toThrow('загрузите файл');
    rollback.record(context.req, upload);
    expect(() => rollback.assertBinding(record, context, isPrivate)).not.toThrow();
    values.filename = 'other.pdf';
    expect(() => rollback.assertBinding(record, context, isPrivate)).toThrow('загрузите файл');
  });

  it.each([true, false])(
    'cleans up a failed upload only if the metadata did not commit (committed: %s)',
    async (committed) => {
      const { rollback, context, upload, findOne, enqueue } = fixture();
      findOne.mockResolvedValue(committed ? { id: '1' } : null);
      rollback.record(context.req, upload);
      const error = new Error('request failed');
      await expect(
        rollback.handle(context, async () => {
          throw error;
        }),
      ).rejects.toThrow(error);
      if (committed) expect(enqueue).not.toHaveBeenCalled();
      else expect(enqueue).toHaveBeenCalledWith('attachments', ['new.pdf'], { currentOnly: true });
    },
  );
});
