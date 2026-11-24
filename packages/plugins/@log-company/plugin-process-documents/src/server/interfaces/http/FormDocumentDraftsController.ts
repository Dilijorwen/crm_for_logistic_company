/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Context, Next } from '@nocobase/actions';
import type { Transaction } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import { koaMulter as multer } from '@nocobase/utils';
import {
  InvalidUploadError,
  inspectUpload,
  processDocumentUpload,
  validateUploadBatch,
} from '@log-company/plugin-file-storage';
import {
  FORM_DOCUMENT_DRAFT_HEADER,
  FORM_DOCUMENT_DRAFT_PENDING,
  documentRecordId,
  isDocumentFormResource,
} from '../../../contracts/processDocuments';
import type { FormDocumentSaveTarget } from '../../../contracts/processDocuments';
import type { DocumentActor } from '../../application/ports/ProcessDocumentsRepository';
import type { PublishFormDocuments } from '../../application/PublishFormDocuments';
import { assertSafeUploadName } from '../../domain/documents/DocumentName';
import { ProcessDocumentsError } from '../../domain/documents/DocumentErrors';
import type { TemporaryDocumentDrafts } from '../../infrastructure/storage/TemporaryDocumentDrafts';
import { decodeUploadedName } from './UploadedDocumentName';

const RESOURCE = 'processDocumentDrafts';
const tokenPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const multipartLimit = processDocumentUpload.maxTotalBytes + 1024 * 1024;
type UploadContext = Context & { files?: { path: string; originalname: string; size: number }[] };
type HookTransaction = Transaction & { id: string };
type CommitDraft = (recordId: string, transaction: HookTransaction) => Promise<void>;

export class FormDocumentDraftsController {
  private readonly commits = new WeakMap<Context, CommitDraft>();
  private readonly hooked = new Set<string>();

  constructor(
    private readonly plugin: Plugin,
    private readonly drafts: TemporaryDocumentDrafts,
    private readonly publish: PublishFormDocuments,
  ) {}

  register(): void {
    this.plugin.app.resourceManager.define({ name: RESOURCE, actions: { stage: this.stage, discard: this.discard } });
    this.plugin.app.acl.allow(RESOURCE, ['stage', 'discard'], 'loggedIn');
    this.plugin.app.resourceManager.use((context, next) => this.publishOnSave(context as Context, next), {
      tag: 'publish-form-documents',
      after: 'acl',
    });
  }

  private readonly stage = async (context: UploadContext, next: Next) => {
    this.assertPost(context);
    await this.handle(context, async (actor) => {
      const { resource, recordId } = context.query;
      const form = this.form(context, resource, recordId ?? null);
      if (!context.can?.({ resource: form.resource, action: form.recordId === null ? 'create' : 'update' })) {
        context.throw(403, 'Нет права сохранять эту форму.');
      }
      if (context.request.length == null || context.request.length > multipartLimit) {
        context.throw(413, 'Размер отправки должен быть известен и не превышать 250 МБ.');
      }
      const policy =
        form.resource === 'permit_documents'
          ? { ...processDocumentUpload, allowNativeFormats: true }
          : processDocumentUpload;
      context.body = await this.drafts.stage(actor.userId, form, async (directory) => {
        const receive = multer({
          dest: directory,
          preservePath: true,
          limits: { files: processDocumentUpload.maxFiles, fileSize: policy.maxFileBytes, fields: 0 },
        }).array('files');
        await receive(context, async () => undefined);
        const files = context.files ?? [];
        validateUploadBatch(files, processDocumentUpload);
        return Promise.all(
          files.map(async (file) => {
            const originalName = decodeUploadedName(file.originalname);
            assertSafeUploadName(originalName);
            return {
              path: file.path,
              originalName,
              size: file.size,
              mimeType: await inspectUpload({ path: file.path, originalName, size: file.size }, policy),
            };
          }),
        );
      });
      await next();
    });
  };

  private readonly discard = async (context: Context, next: Next) => {
    this.assertPost(context);
    await this.handle(context, async (actor) => {
      const body = context.request.body;
      const tokens = body && typeof body === 'object' && 'tokens' in body ? body.tokens : undefined;
      await this.drafts.discard(this.tokens(tokens), actor.userId);
      context.body = true;
      await next();
    });
  };

  private async publishOnSave(context: Context, next: Next): Promise<void> {
    const header = context.get(FORM_DOCUMENT_DRAFT_HEADER);
    const action = context.action;
    if (!header || !action || !['create', 'update'].includes(action.actionName)) return next();

    await this.handle(context, async (actor) => {
      if (header === FORM_DOCUMENT_DRAFT_PENDING)
        context.throw(409, 'Дождитесь загрузки файлов и сохраните форму снова.');
      const form = this.form(
        context,
        action.resourceName,
        action.actionName === 'create' ? null : action.params.filterByTk,
      );
      if (Array.isArray(action.params.values) || action.sourceId != null) {
        context.throw(400, 'Загрузка поддерживается только при сохранении одной записи.');
      }
      const batch = this.drafts.acquire(this.tokens(header.split(',')), actor.userId, form);
      this.ensureHook(form.resource);
      let saved = false;
      let published = false;
      this.commits.set(context, async (recordId, transaction) => {
        if (published || (form.recordId !== null && form.recordId !== recordId))
          throw new ProcessDocumentsError('FORM_DRAFT_BUSY', 'Загрузка поддерживается для одной записи.');
        published = true;
        await this.publish.execute(
          {
            resource: form.resource,
            recordId,
            files: batch.files,
            actor: form.recordId === null ? { ...actor, creatingOwner: { resource: form.resource, recordId } } : actor,
          },
          {
            transaction,
            onRollback: (cleanup) => this.plugin.db.once(`transactionRollback:${transaction.id}`, cleanup),
          },
        );
        transaction.afterCommit(() => {
          saved = true;
        });
      });
      try {
        await next();
        if (!saved && context.status < 400) {
          context.throw(409, 'Файлы не сохранены. Проверьте, что блок подключён к штатной форме одной записи.');
        }
      } finally {
        this.commits.delete(context);
        await batch.release(saved);
      }
    });
  }

  private ensureHook(resource: string): void {
    if (this.hooked.has(resource)) return;
    this.hooked.add(resource);
    this.plugin.db.on(
      `${resource}.afterSaveWithAssociations`,
      async (
        record: { get(key: string): unknown },
        options: {
          context?: Context;
          transaction?: HookTransaction;
        },
      ) => {
        if (!options.context) return;
        const commit = this.commits.get(options.context);
        if (!commit) return;
        const id = documentRecordId(record.get('id'));
        if (!options.transaction || !id) {
          throw new ProcessDocumentsError('FORM_DRAFT_BUSY', 'Не удалось сохранить файлы вместе с записью.');
        }
        await commit(id, options.transaction);
      },
    );
  }

  private form(context: Context, resource: unknown, recordId: unknown): FormDocumentSaveTarget {
    if (
      !isDocumentFormResource(resource) ||
      !this.plugin.db.getCollection(resource) ||
      (context.get('X-Data-Source') || 'main') !== 'main'
    )
      throw new ProcessDocumentsError('INVALID_DOCUMENT_SCOPE', 'Не найдена форма основного источника данных.');
    const id = recordId === null ? null : documentRecordId(recordId);
    if (id === undefined) throw new ProcessDocumentsError('INVALID_DOCUMENT_SCOPE', 'Не найдена сохраняемая запись.');
    return { resource, recordId: id };
  }

  private tokens(value: unknown): string[] {
    if (
      !Array.isArray(value) ||
      !value.length ||
      value.length > processDocumentUpload.maxFiles ||
      !value.every((token): token is string => typeof token === 'string' && tokenPattern.test(token))
    ) {
      throw new ProcessDocumentsError('INVALID_DRAFT_TOKEN', 'Неверный черновик документов.');
    }
    return [...new Set(value)];
  }

  private assertPost(context: Context) {
    if (context.method !== 'POST') context.throw(405);
  }

  private async handle(context: Context, run: (actor: DocumentActor & { userId: string }) => Promise<void>) {
    const userId = context.state.currentUser?.id;
    if (userId == null) context.throw(401, 'Войдите в систему.');
    const role = context.state.currentRole;
    const roles = role && role !== 'union' ? [String(role)] : (context.state.currentRoles ?? []).map(String);
    try {
      await run({ userId: String(userId), isRoot: roles.includes('root'), roles, authorizationContext: context });
    } catch (error) {
      if (error instanceof InvalidUploadError) context.throw(400, error.message);
      if (error instanceof ProcessDocumentsError) {
        const status = error.code.endsWith('_ACCESS_DENIED')
          ? 403
          : error.code.endsWith('_NOT_FOUND')
            ? 404
            : error.code === 'FORM_DRAFT_BUSY' || error.code === 'FORM_DRAFT_EXPIRED'
              ? 409
              : error.code === 'STORAGE_UPLOAD_FAILED'
                ? 503
                : 400;
        context.throw(status, error.message);
      }
      if (error instanceof Error && 'code' in error && String(error.code).startsWith('LIMIT_')) {
        context.throw(413, 'Превышен лимит размера или количества файлов.');
      }
      throw error;
    }
  }
}
