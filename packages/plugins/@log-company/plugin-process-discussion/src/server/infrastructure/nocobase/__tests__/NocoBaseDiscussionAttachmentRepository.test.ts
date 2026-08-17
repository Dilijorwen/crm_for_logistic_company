/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Model } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import { describe, expect, it, vi } from 'vitest';
import type { DiscussionAttachmentTransaction } from '../../../application/ports/DiscussionAttachmentRepository';
import { NocoBaseDiscussionAttachmentRepository } from '../NocoBaseDiscussionAttachmentRepository';

const transaction = { LOCK: { UPDATE: 'UPDATE' } } as unknown as DiscussionAttachmentTransaction;

interface TestField {
  type: string;
  options: Record<string, unknown>;
}

function testCollection(name: string, fields: TestField[], referenceCount: number) {
  return {
    name,
    getFields: () => fields,
    model: {
      count: vi.fn().mockResolvedValue(referenceCount),
    },
  };
}

function setup(sourceReferenceCount: number, throughReferenceCount: number) {
  const source = testCollection(
    'sourceRecords',
    [
      { type: 'belongsTo', options: { target: 'attachments', foreignKey: 'logoId' } },
      {
        type: 'belongsToMany',
        options: { target: 'attachments', through: 'sourceAttachments', otherKey: 'attachmentId' },
      },
      { type: 'hasMany', options: { target: 'attachments', foreignKey: 'sourceId' } },
    ],
    sourceReferenceCount,
  );
  const through = testCollection('sourceAttachments', [], throughReferenceCount);
  const collections = new Map([
    [source.name, source],
    [through.name, through],
  ]);
  const plugin = {
    db: {
      collections,
      getCollection: (name: string) => collections.get(name),
    },
  } as unknown as Plugin;
  return {
    repository: new NocoBaseDiscussionAttachmentRepository(plugin),
    sourceCount: source.model.count,
    throughCount: through.model.count,
  };
}

describe('NocoBaseDiscussionAttachmentRepository', () => {
  it('detects a belongs-to attachment reference without rejecting the standard relation type', async () => {
    const { repository, sourceCount, throughCount } = setup(1, 0);

    await expect(repository.isReferenced('22', transaction)).resolves.toBe(true);

    expect(sourceCount).toHaveBeenCalledWith(expect.objectContaining({ where: { logoId: '22' }, paranoid: false }));
    expect(throughCount).not.toHaveBeenCalled();
  });

  it('detects a belongs-to-many reference through its junction collection', async () => {
    const { repository, sourceCount, throughCount } = setup(0, 1);

    await expect(repository.isReferenced('22', transaction)).resolves.toBe(true);

    expect(sourceCount).toHaveBeenCalledOnce();
    expect(throughCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { attachmentId: '22' }, paranoid: false }),
    );
  });

  it('returns false when neither supported relation type references the attachment', async () => {
    const { repository } = setup(0, 0);

    await expect(repository.isReferenced('22', transaction)).resolves.toBe(false);
  });

  it('locks the attachment row before checking ownership and references', async () => {
    const findOne = vi.fn().mockResolvedValue({
      get: (field: string) =>
        ({
          id: 22,
          createdById: 7,
          meta: { attachmentPurpose: 'process-discussion' },
        })[field],
    } as unknown as Model);
    const plugin = {
      db: {
        getRepository: () => ({ findOne }),
      },
    } as unknown as Plugin;
    const repository = new NocoBaseDiscussionAttachmentRepository(plugin);

    await expect(repository.findById('22', transaction)).resolves.toMatchObject({ id: '22', createdById: '7' });
    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ filterByTk: '22', lock: 'UPDATE' }));
  });
});
