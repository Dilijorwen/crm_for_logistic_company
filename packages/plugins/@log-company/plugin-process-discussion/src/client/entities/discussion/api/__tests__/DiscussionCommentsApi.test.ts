/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { APIClient } from '@nocobase/client';
import { ACL } from '@nocobase/acl';
import { createMockDatabase, type Database } from '@nocobase/database';
import { sanitizeAssociationValues } from '@nocobase/plugin-acl/src/server/middlewares/check-change-with-association';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDiscussionComment, type DiscussionCommentValues } from '../DiscussionCommentsApi';

describe('discussion attachment submission with collection ACL', () => {
  let db: Database;
  let acl: ACL;

  beforeEach(async () => {
    db = await createMockDatabase({ dialect: 'sqlite', storage: ':memory:' });
    db.collection({ name: 'shipments' });
    db.collection({ name: 'attachments', fields: [{ name: 'title', type: 'string' }] });
    db.collection({
      name: 'shipment_comments',
      fields: [
        { name: 'shipment', type: 'belongsTo', target: 'shipments', foreignKey: 'shipment_id' },
        { name: 'text', type: 'text' },
        { name: 'attachment', type: 'belongsToMany', target: 'attachments', through: 'shipment_comment_attachments' },
      ],
    });
    await db.sync();
    await db.getRepository('shipments').create({ values: { id: 42 } });
    await db.getRepository('attachments').create({ values: { id: 100, title: 'Документ' } });
    acl = new ACL();
    acl.define({
      role: 'manager',
      actions: {
        'shipment_comments:create': { whitelist: ['shipment', 'shipment_id', 'text', 'attachment'] },
      },
    });
  });

  afterEach(async () => db.close());

  function client() {
    const create = vi.fn(async (options: { values: DiscussionCommentValues; updateAssociationValues?: string[] }) => {
      const permission = acl.can({ role: 'manager', resource: 'shipment_comments', action: 'create' });
      const values = await sanitizeAssociationValues({
        acl,
        db,
        roles: ['manager'],
        resourceName: 'shipment_comments',
        actionName: 'create',
        aclParams: permission?.params,
        values: options.values,
        updateAssociationValues: options.updateAssociationValues,
      });
      return db.getRepository('shipment_comments').create({ values });
    });
    return { api: { resource: () => ({ create }) } as unknown as Pick<APIClient, 'resource'>, create };
  }

  it.each(['Сообщение с документом', ' '])('retains the uploaded file for a manager: %j', async (text) => {
    const { api } = client();
    expect(acl.can({ role: 'manager', resource: 'attachments', action: 'update' })).toBeNull();
    await createDiscussionComment(api, { shipment: { id: 42 }, shipment_id: 42, text, attachment: [100] });
    const comment = await db.getRepository('shipment_comments').findOne({ appends: ['attachment'] });
    expect(comment.get('text')).toBe(text);
    expect(comment.toJSON().attachment).toEqual([expect.objectContaining({ id: 100, title: 'Документ' })]);
    expect((await db.getRepository('attachments').findOne({ filterByTk: 100 })).get('title')).toBe('Документ');
  });

  it('preserves text-only submission and does not bypass denied attachment fields', async () => {
    const { api } = client();
    acl.define({
      role: 'manager',
      actions: { 'shipment_comments:create': { whitelist: ['shipment', 'shipment_id', 'text'] } },
    });
    await createDiscussionComment(api, {
      shipment: { id: 42 },
      shipment_id: 42,
      text: 'Текст',
      attachment: [100],
    });
    const comment = await db.getRepository('shipment_comments').findOne({ appends: ['attachment'] });
    expect(comment.get('text')).toBe('Текст');
    expect(comment.toJSON().attachment).toEqual([]);
  });

  it('propagates a failed request so the composer can retain its draft and report the error', async () => {
    const { api, create } = client();
    create.mockRejectedValueOnce(new Error('Сервис недоступен'));
    await expect(
      createDiscussionComment(api, { shipment: { id: 42 }, shipment_id: 42, text: 'Текст', attachment: [] }),
    ).rejects.toThrow('Сервис недоступен');
    expect(await db.getRepository('shipment_comments').count()).toBe(0);
  });
});
