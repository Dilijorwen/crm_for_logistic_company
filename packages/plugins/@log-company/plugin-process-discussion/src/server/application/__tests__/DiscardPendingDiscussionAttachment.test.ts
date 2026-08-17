/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { PROCESS_DISCUSSION_ATTACHMENT_PURPOSE } from '../../../shared/processDiscussionAttachments';
import { DiscardPendingDiscussionAttachment } from '../DiscardPendingDiscussionAttachment';
import type {
  DiscussionAttachmentRecord,
  DiscussionAttachmentRepository,
  DiscussionAttachmentTransaction,
} from '../ports/DiscussionAttachmentRepository';

const transaction: DiscussionAttachmentTransaction = {};

function attachment(overrides: Partial<DiscussionAttachmentRecord> = {}): DiscussionAttachmentRecord {
  return {
    id: '22',
    createdById: '7',
    purpose: PROCESS_DISCUSSION_ATTACHMENT_PURPOSE,
    ...overrides,
  };
}

function dependencies(record: DiscussionAttachmentRecord | null = attachment()) {
  const findById = vi.fn().mockResolvedValue(record);
  const isReferenced = vi.fn().mockResolvedValue(false);
  const deleteById = vi.fn().mockResolvedValue(undefined);
  const withTransaction = vi.fn(async <T>(work: (currentTransaction: DiscussionAttachmentTransaction) => Promise<T>) =>
    work(transaction),
  );
  const repository: DiscussionAttachmentRepository = {
    withTransaction,
    findById,
    isReferenced,
    deleteById,
  };
  return { repository, withTransaction, findById, isReferenced, deleteById };
}

describe('DiscardPendingDiscussionAttachment', () => {
  it('deletes an owned, pending and unreferenced attachment', async () => {
    const deps = dependencies();
    const useCase = new DiscardPendingDiscussionAttachment(deps.repository);

    await useCase.execute({ attachmentId: '22', actorId: '7' });

    expect(deps.findById).toHaveBeenCalledWith('22', transaction);
    expect(deps.isReferenced).toHaveBeenCalledWith('22', transaction);
    expect(deps.deleteById).toHaveBeenCalledWith('22', transaction);
  });

  it('rejects an unknown attachment', async () => {
    const deps = dependencies(null);
    const useCase = new DiscardPendingDiscussionAttachment(deps.repository);

    await expect(useCase.execute({ attachmentId: '404', actorId: '7' })).rejects.toMatchObject({
      code: 'ATTACHMENT_NOT_FOUND',
    });
    expect(deps.deleteById).not.toHaveBeenCalled();
  });

  it('rejects an attachment owned by another user', async () => {
    const deps = dependencies(attachment({ createdById: '8' }));
    const useCase = new DiscardPendingDiscussionAttachment(deps.repository);

    await expect(useCase.execute({ attachmentId: '22', actorId: '7' })).rejects.toMatchObject({
      code: 'ATTACHMENT_DELETE_FORBIDDEN',
    });
    expect(deps.isReferenced).not.toHaveBeenCalled();
    expect(deps.deleteById).not.toHaveBeenCalled();
  });

  it('rejects an attachment uploaded outside the process discussion', async () => {
    const deps = dependencies(attachment({ purpose: null }));
    const useCase = new DiscardPendingDiscussionAttachment(deps.repository);

    await expect(useCase.execute({ attachmentId: '22', actorId: '7' })).rejects.toMatchObject({
      code: 'ATTACHMENT_DELETE_FORBIDDEN',
    });
    expect(deps.deleteById).not.toHaveBeenCalled();
  });

  it('does not delete an attachment already linked to any record', async () => {
    const deps = dependencies();
    deps.isReferenced.mockResolvedValue(true);
    const useCase = new DiscardPendingDiscussionAttachment(deps.repository);

    await expect(useCase.execute({ attachmentId: '22', actorId: '7' })).rejects.toMatchObject({
      code: 'ATTACHMENT_IN_USE',
    });
    expect(deps.deleteById).not.toHaveBeenCalled();
  });

  it('propagates repository deletion failures', async () => {
    const deps = dependencies();
    const deletionError = new Error('storage deletion failed');
    deps.deleteById.mockRejectedValue(deletionError);
    const useCase = new DiscardPendingDiscussionAttachment(deps.repository);

    await expect(useCase.execute({ attachmentId: '22', actorId: '7' })).rejects.toBe(deletionError);
  });
});
