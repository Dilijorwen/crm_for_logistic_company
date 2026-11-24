/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Next } from '@nocobase/actions';
import type { Plugin } from '@nocobase/server';
import { RunDiscussionAttachmentDenied, WriteRunDiscussionComment } from '../../application/WriteRunDiscussionComment';
import {
  RUN_COMMENTS_COLLECTION,
  type NocoBaseRunDiscussion,
  type RunDiscussionContext,
} from '../../infrastructure/nocobase/NocoBaseRunDiscussion';

const RESOURCE = 'workspaceRunDiscussion';
const isId = (value: unknown) =>
  (typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value))) &&
  /^[1-9]\d{0,18}$/.test(String(value)) &&
  BigInt(String(value)) <= 9223372036854775807n;

export class RunDiscussionController {
  constructor(
    private readonly plugin: Plugin,
    private readonly discussion: NocoBaseRunDiscussion,
    private readonly write: WriteRunDiscussionComment,
  ) {}

  register(): void {
    this.plugin.app.resourceManager.use(
      async (ctx, next) => {
        const resource = ctx.action?.resourceName?.split('.') ?? [];
        if (resource.includes(RUN_COMMENTS_COLLECTION) || resource.includes('transport_run_comment_attachments')) {
          ctx.throw(403, 'Сообщения доступны в общем обсуждении.');
        }
        await next();
      },
      { tag: 'workspace-run-discussion-storage', after: 'acl' },
    );
    this.plugin.app.resourceManager.define({
      name: RESOURCE,
      actions: { list: this.list, create: this.create },
    });
    this.plugin.app.acl.allow(RESOURCE, ['list', 'create'], 'loggedIn');
  }

  private readonly list = async (ctx: RunDiscussionContext, next: Next): Promise<void> => {
    const { runId, limit: rawLimit } = ctx.action.params;
    const limit = Number(rawLimit ?? 50);
    if (!isId(runId) || !Number.isInteger(limit) || limit < 1 || limit > 5000) {
      ctx.throw(400, 'Неверные параметры обсуждения.');
      return;
    }
    const permission = await this.discussion.permissions(ctx, String(runId), 'list');
    if (!permission) {
      ctx.throw(403, 'Нет доступа к обсуждению рейса.');
      return;
    }
    const result = await this.discussion.list(String(runId), permission, limit);
    ctx.body = { rows: result.data, ...result.meta };
    await next();
  };

  private readonly create = async (ctx: RunDiscussionContext, next: Next): Promise<void> => {
    const actorId = ctx.state?.currentUser?.id;
    const { runId, text, attachmentIds = [] } = ctx.action.params.values ?? {};
    if (!isId(actorId)) {
      ctx.throw(401, 'Требуется авторизация.');
      return;
    }
    if (
      !isId(runId) ||
      typeof text !== 'string' ||
      text.length > 10000 ||
      !Array.isArray(attachmentIds) ||
      attachmentIds.length > 20 ||
      !attachmentIds.every(isId) ||
      (!text.trim() && !attachmentIds.length)
    ) {
      ctx.throw(400, 'Проверьте текст сообщения и вложения.');
      return;
    }
    const permission = await this.discussion.permissions(ctx, String(runId), 'create');
    const allowed = (field: string) => !permission?.params?.fields || permission.params.fields.includes(field);
    if (!permission || (text.trim() && !allowed('text')) || (attachmentIds.length && !allowed('attachment'))) {
      ctx.throw(403, 'Нет прав отправлять сообщения в обсуждение рейса.');
      return;
    }
    try {
      await this.write.execute({
        runId: String(runId),
        actorId: String(actorId),
        text: text.trim(),
        attachmentIds: [...new Set<string>(attachmentIds.map(String))],
      });
    } catch (error) {
      if (!(error instanceof RunDiscussionAttachmentDenied)) throw error;
      ctx.throw(403, 'Выберите доступное вложение и повторите отправку.');
      return;
    }
    ctx.body = { created: true };
    await next();
  };
}
