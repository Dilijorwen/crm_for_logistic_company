/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createMockDatabase } from '@nocobase/database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import runComments from '../../../collections/transportRunComments';
import { NocoBaseRunDiscussion, type RunDiscussionContext } from '../NocoBaseRunDiscussion';
import type { DiscussionAttachmentTransaction } from '../../../application/ports/DiscussionAttachmentRepository';

type TestDatabase = Awaited<ReturnType<typeof createMockDatabase>>;
let db: TestDatabase;

beforeEach(async () => {
  db = await createMockDatabase({ dialect: 'sqlite', storage: ':memory:' });
  db.collection({ name: 'transport_runs', fields: [{ type: 'string', name: 'status' }] });
  db.collection({ name: 'users', fields: [{ type: 'string', name: 'nickname' }] });
  db.collection({ name: 'attachments', fields: [{ type: 'string', name: 'title' }] });
  const comments = db.collection(runComments);
  // plugin-users adds this association when it loads collections with createdBy enabled.
  comments.setField('createdBy', {
    type: 'belongsTo',
    target: 'users',
    foreignKey: 'createdById',
  });
  await db.sync();
});

afterEach(async () => {
  await db.close();
});

function withPermissions(runPermission: object | null, discussionPermission: object | null) {
  return {
    state: { currentUser: { id: '1' } },
    get: vi.fn(),
    can: ({ resource }: { resource: string }) => (resource === 'transport_runs' ? runPermission : discussionPermission),
  } as unknown as RunDiscussionContext;
}

describe('Хранение обсуждения рейса', () => {
  it('пишет в один рейс с автором и читает только его сообщения и разрешённые поля', async () => {
    const discussion = new NocoBaseRunDiscussion(db);
    const runs = db.getRepository('transport_runs');
    const first = await runs.create({ values: { status: 'open' } });
    const second = await runs.create({ values: { status: 'closed' } });
    const author = await db.getRepository('users').create({ values: { nickname: 'Автор' } });
    const file = await db.getRepository('attachments').create({ values: { title: 'Документ' } });
    await db.sequelize.transaction(async (transaction) => {
      const session = transaction as unknown as DiscussionAttachmentTransaction;
      await discussion.create(
        { runId: String(first.id), actorId: String(author.id), text: 'В пути', attachmentIds: [String(file.id)] },
        session,
      );
      await discussion.create(
        { runId: String(second.id), actorId: String(author.id), text: 'В другом рейсе', attachmentIds: [] },
        session,
      );
    });

    const current = await discussion.list(String(first.id), {}, 50);
    expect(current).toMatchObject({
      data: [{ text: 'В пути', createdBy: { nickname: 'Автор' }, attachment: [{ title: 'Документ' }] }],
      meta: { count: 1 },
    });
    const limited = await discussion.list(String(first.id), { params: { fields: ['text'] } }, 50);
    expect(limited.data[0].attachment).toBeUndefined();
    expect(limited.data[0].createdBy).toBeUndefined();
  });

  it('отказывает без прав на комментарии или доступа к конкретному рейсу', async () => {
    const discussion = new NocoBaseRunDiscussion(db);
    const run = await db.getRepository('transport_runs').create({ values: { status: 'closed' } });
    const id = String(run.id);
    expect(await discussion.permissions(withPermissions({}, null), id, 'create')).toBeUndefined();
    expect(
      await discussion.permissions(withPermissions({ params: { filter: { status: 'open' } } }, {}), id, 'list'),
    ).toBeUndefined();
    expect(await discussion.permissions(withPermissions({}, {}), id, 'list')).toEqual({});
  });
});
