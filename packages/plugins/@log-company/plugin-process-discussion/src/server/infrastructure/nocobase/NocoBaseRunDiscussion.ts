/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createUserProvider, parseJsonTemplate } from '@nocobase/acl';
import type { Context } from '@nocobase/actions';
import type { Database, Model, Transaction } from '@nocobase/database';
import type { RunDiscussionCommentInput } from '../../application/WriteRunDiscussionComment';
import type { DiscussionAttachmentTransaction } from '../../application/ports/DiscussionAttachmentRepository';

interface CommentFile {
  id: string | number;
  title?: string;
  filename?: string;
  url?: string;
  extname?: string;
  size?: number;
}

export const RUN_COMMENTS_COLLECTION = 'transport_run_comments';
type DiscussionOperation = 'list' | 'create';
interface Permission {
  params?: { filter?: Record<string, unknown>; fields?: string[] };
}
export type RunDiscussionContext = Context & {
  can?: (request: { resource: string; action: string }) => Permission | null;
};

export class NocoBaseRunDiscussion {
  constructor(private readonly db: Database) {}

  async permissions(context: RunDiscussionContext, runId: string, operation: DiscussionOperation) {
    const runPermission = context.can?.({ resource: 'transport_runs', action: 'list' });
    const discussion = context.can?.({ resource: 'shipment_comments', action: operation });
    // Shipment-specific scopes cannot be evaluated against messages belonging to a run.
    if (!runPermission || !discussion || (discussion.params?.filter && Object.keys(discussion.params.filter).length))
      return;
    const runFilter = runPermission.params?.filter;
    const filter = runFilter
      ? await parseJsonTemplate(runFilter, {
          state: context.state,
          timezone: context.get('x-timezone'),
          userProvider: createUserProvider({ db: this.db, currentUser: context.state.currentUser }),
        })
      : undefined;
    const run = await this.db.getRepository('transport_runs').findOne({ filterByTk: runId, filter, fields: ['id'] });
    if (run) return discussion;
  }

  async list(runId: string, permission: Permission, limit: number) {
    const allowed = (field: string) => !permission.params?.fields || permission.params.fields.includes(field);
    const repository = this.db.getRepository(RUN_COMMENTS_COLLECTION);
    const [rows, count]: [Model[], number] = await repository.findAndCount({
      filter: { transport_run_id: runId },
      sort: ['-createdAt', '-id'],
      limit,
      fields: ['id', 'createdAt', ...(allowed('text') ? ['text'] : [])],
      appends: [...(allowed('attachment') ? ['attachment'] : []), ...(allowed('createdBy') ? ['createdBy'] : [])],
    });
    return {
      data: rows.map((row) => {
        const record = row.toJSON();
        return {
          id: record.id,
          text: record.text,
          createdAt: record.createdAt,
          createdBy: record.createdBy && {
            id: record.createdBy.id,
            nickname: record.createdBy.nickname,
            username: record.createdBy.username,
          },
          attachment: (record.attachment as CommentFile[] | undefined)?.map(
            ({ id, title, filename, url, extname, size }) => ({
              id,
              title,
              filename,
              url,
              extname,
              size,
            }),
          ),
        };
      }),
      meta: { count },
    };
  }

  async create(input: RunDiscussionCommentInput, transaction: DiscussionAttachmentTransaction): Promise<void> {
    await this.db.getRepository(RUN_COMMENTS_COLLECTION).create({
      values: {
        transport_run_id: input.runId,
        createdById: input.actorId,
        text: input.text,
        attachment: input.attachmentIds,
      },
      transaction: transaction as unknown as Transaction,
    });
  }
}
