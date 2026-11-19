/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database, Transaction } from '@nocobase/database';
import { describe, expect, it, vi } from 'vitest';
import type { FileStorageService } from '../../FileStorageService';
import { FileDeletionQueue } from '../FileDeletionQueue';

function fixture() {
  const query = vi.fn().mockResolvedValue([[]]);
  const remove = vi.fn().mockResolvedValue(true);
  const area = vi.fn(() => ({ delete: remove }));
  const report = vi.fn();
  const queue = new FileDeletionQueue(
    { sequelize: { query } } as unknown as Database,
    { area } as unknown as FileStorageService,
    'main',
    report,
  );
  return { query, remove, area, report, queue };
}

describe('FileDeletionQueue', () => {
  it('uses the metadata transaction and stores only distinct exact keys', async () => {
    const { query, remove, queue } = fixture();
    const transaction = {} as Transaction;
    await queue.enqueue('process-documents', ['shipments/1/a.pdf', 'shipments/1/a.pdf'], { transaction });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('insert into'), {
      replacements: {
        application: 'main',
        area: 'process-documents',
        keys: '["shipments/1/a.pdf"]',
        currentOnly: false,
      },
      transaction,
    });
    expect(remove).not.toHaveBeenCalled();
    await expect(queue.enqueue('process-documents', ['../another-area'])).rejects.toThrow();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('retries failed jobs and acknowledges only successful deletes within their recorded areas', async () => {
    const { query, area, queue, remove, report } = fixture();
    const first = { id: '1', area: 'chat-attachments', object_key: 'chats/tmp/1/receipt', current_only: true };
    const second = { id: '2', area: 'process-documents', object_key: 'shipments/1/invoice', current_only: false };
    query.mockResolvedValueOnce([[first, second]]);
    remove.mockRejectedValueOnce(new Error('MinIO unavailable'));
    await queue.flush();
    expect(area.mock.calls).toEqual([['chat-attachments'], ['process-documents']]);
    expect(remove.mock.calls).toEqual([
      [first.object_key, true],
      [second.object_key, false],
    ]);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('delete from'), { replacements: { id: '2' } });
    expect(query).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenCalledOnce();

    query.mockResolvedValueOnce([[first]]);
    await queue.flush();
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('delete from'), { replacements: { id: '1' } });
  });
});
