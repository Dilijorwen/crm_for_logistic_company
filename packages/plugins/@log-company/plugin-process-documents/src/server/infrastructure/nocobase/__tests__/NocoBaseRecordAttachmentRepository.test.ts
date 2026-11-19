/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Database } from '@nocobase/database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NocoBaseRecordAttachmentRepository } from '../NocoBaseRecordAttachmentRepository';

describe('deleting a native attachment', () => {
  let database: Database;
  const enqueue = vi.fn();
  const file = { collection: 'cards', field: 'documents', recordId: '10', attachmentId: '20' };
  const actor = { userId: '1', isRoot: true, roles: ['root'] };
  let repository: NocoBaseRecordAttachmentRepository;

  beforeEach(async () => {
    vi.resetAllMocks();
    database = new Database({ dialect: 'sqlite', storage: ':memory:' });
    database.collection({
      name: 'attachments',
      fields: [
        { type: 'string', name: 'filename' },
        { type: 'string', name: 'path' },
        { type: 'bigInt', name: 'storageId' },
      ],
    });
    database.collection({
      name: 'cards',
      fields: [{ type: 'belongsToMany', name: 'documents', interface: 'attachment', target: 'attachments' }],
    });
    await database.sync();
    await database.getRepository('attachments').create({ values: { id: 20, filename: 'test.xlsx', storageId: 2 } });
    await database.getRepository('cards').create({ values: { id: 10, documents: [20] } });
    await database.getRepository('cards').create({ values: { id: 11 } });
    repository = new NocoBaseRecordAttachmentRepository(
      database,
      (attachment) => ({
        backend: 'minio',
        key: String(attachment.filename),
      }),
      enqueue,
    );
  });

  afterEach(async () => {
    await database.close();
  });

  it('removes both the link and attachment and enqueues the physical object in the transaction', async () => {
    await repository.deleteFromRecord(file, actor);
    const owner = await database.getRepository('cards').findOne({ filterByTk: 10, appends: ['documents'] });
    expect(owner.get('documents')).toEqual([]);
    expect(await database.getRepository('attachments').findOne({ filterByTk: 20 })).toBeNull();
    expect(enqueue).toHaveBeenCalledWith('attachments', ['test.xlsx'], { transaction: expect.anything() });
    await expect(repository.deleteFromRecord(file, actor)).rejects.toMatchObject({ code: 'DOCUMENT_NOT_FOUND' });
  });

  it('does not detach or delete a file used in another card', async () => {
    await database.getRepository('cards').update({ filterByTk: 11, values: { documents: [20] } });
    await expect(repository.deleteFromRecord(file, actor)).rejects.toMatchObject({ code: 'ATTACHMENT_IN_USE' });
    expect(await database.getRepository('attachments').count()).toBe(1);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('does not delete files from unrelated or inaccessible cards', async () => {
    await expect(repository.deleteFromRecord({ ...file, recordId: '11' }, actor)).rejects.toMatchObject({
      code: 'DOCUMENT_NOT_FOUND',
    });
    await expect(
      repository.deleteFromRecord(file, {
        ...actor,
        isRoot: false,
        authorizationContext: { can: () => ({ params: { whitelist: ['title'] } }), get: () => '' },
      }),
    ).rejects.toMatchObject({ code: 'DOCUMENT_ACCESS_DENIED' });
    expect(await database.getRepository('attachments').count()).toBe(1);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('keeps the link and attachment if scheduling MinIO deletion fails', async () => {
    enqueue.mockRejectedValue(new Error('queue unavailable'));
    await expect(repository.deleteFromRecord(file, actor)).rejects.toThrow('queue unavailable');
    expect(await database.getRepository('attachments').count()).toBe(1);
    const owner = await database.getRepository('cards').findOne({ filterByTk: 10, appends: ['documents'] });
    expect(owner.get('documents')).toHaveLength(1);
  });
});
