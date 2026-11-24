/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { RunDiscussionAttachmentDenied, WriteRunDiscussionComment } from '../WriteRunDiscussionComment';
import { PROCESS_DISCUSSION_ATTACHMENT_PURPOSE } from '../../../shared/processDiscussionAttachments';

function fixture(owner = '7', referenced = false) {
  const transaction = {};
  const comments = { create: vi.fn() };
  const attachments = {
    withTransaction: <T>(work: (transaction: object) => Promise<T>) => work(transaction),
    findById: vi
      .fn()
      .mockResolvedValue({ id: '3', createdById: owner, purpose: PROCESS_DISCUSSION_ATTACHMENT_PURPOSE }),
    isReferenced: vi.fn().mockResolvedValue(referenced),
    deleteById: vi.fn(),
  };
  const write = new WriteRunDiscussionComment(attachments, comments);
  const input = { runId: '10', actorId: '7', text: 'В пути', attachmentIds: ['3'] };
  return { write, comments, transaction, input };
}

describe('Запись сообщения рейса', () => {
  it('прикрепляет собственный черновый файл при записи сообщения', async () => {
    const { write, input, comments, transaction } = fixture();
    await write.execute(input);
    expect(comments.create).toHaveBeenCalledWith(input, transaction);
  });

  it.each([
    ['2', false],
    ['7', true],
  ])('отклоняет чужой или уже привязанный файл', async (owner, referenced) => {
    const { write, input, comments } = fixture(owner, referenced);
    await expect(write.execute(input)).rejects.toBeInstanceOf(RunDiscussionAttachmentDenied);
    expect(comments.create).not.toHaveBeenCalled();
  });
});
