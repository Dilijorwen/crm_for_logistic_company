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
  supportsFormFolderUploads,
} from '../../../contracts/processDocuments';
import type { FormDocumentSaveTarget } from '../../../contracts/processDocuments';
import type { DocumentActor } from '../../application/ports/ProcessDocumentsRepository';
import type { DocumentScopeService } from '../../application/DocumentScopeService';
import type { PublishFormDocuments } from '../../application/PublishFormDocuments';
import type { UploadedDocumentFile } from '../../application/UploadProcessDocuments';
import { assertSafeUploadName } from '../../domain/documents/DocumentName';
import { ProcessDocumentsError } from '../../domain/documents/DocumentErrors';
import type { TemporaryDocumentDrafts } from '../../infrastructure/storage/TemporaryDocumentDrafts';
import {
  documentUploadFieldBytes,
  documentUploadRequestBytes,
  parseUploadedEmptyFolders,
  resolveUploadedFilePaths,
} from './UploadedDocumentName';

const RESOURCE = 'processDocumentDrafts';
const tokenPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
type UploadContext = Context & { files?: { path: string; originalname: string; size: number }[] };
type HookTransaction = Transaction & { id: string };
const captureWorkspaceShipment = Symbol('captureWorkspaceShipment');
type WorkspaceDraftContext = Context & { [captureWorkspaceShipment]?: (tokens: unknown[], id: string) => void };

const workspaceShipmentDraftField = '_workspaceShipmentDocuments';

function shipmentDraftTokens(row: unknown): unknown {
  return row && typeof row === 'object' && workspaceShipmentDraftField in row
    ? row[workspaceShipmentDraftField]
    : undefined;
}

type CommitDraft = (recordId: string, transaction: HookTransaction) => Promise<void>;

export class FormDocumentDraftsController {
  private readonly workspaceCommits = new WeakMap<Context, CommitDraft>();
  private readonly commits = new WeakMap<Context, CommitDraft>();
  private readonly hooked = new Set<string>();

  constructor(
    private readonly plugin: Plugin,
    private readonly drafts: TemporaryDocumentDrafts,
    private readonly publish: PublishFormDocuments,
    private readonly scopes: DocumentScopeService,
  ) {}

  register(): void {
    this.plugin.app.resourceManager.define({
      name: RESOURCE,
      actions: {
        stage: this.stage,
        discard: this.discard,
        editFile: this.editFile,
        shipmentPermissions: this.shipmentPermissions,
      },
    });
    this.plugin.app.acl.allow(RESOURCE, ['stage', 'discard', 'editFile', 'shipmentPermissions'], 'loggedIn');
    this.plugin.db.on(
      'shipments.afterCreate',
      (
        shipment: { get(key: string): unknown },
        options: { context?: WorkspaceDraftContext; inputValues?: unknown },
      ) => {
        const tokens = shipmentDraftTokens(options.inputValues);
        const id = documentRecordId(shipment.get('id'));
        if (id && Array.isArray(tokens) && tokens.length) options.context?.[captureWorkspaceShipment]?.(tokens, id);
      },
    );
    this.plugin.app.resourceManager.use(
      (context, next) => this.publishWorkspaceShipmentDrafts(context as Context, next),
      {
        tag: 'publish-form-documents',
        after: 'acl',
      },
    );
  }

  private readonly shipmentPermissions = async (context: Context, next: Next) => {
    this.assertPost(context);
    await this.handle(context, async (actor) => {
      const resource = context.query.resource === 'transport_runs' ? 'transport_runs' : 'shipments';
      const form = this.form(context, resource, context.query.recordId ?? null);
      const companyId = this.shipmentCompany(context, form);
      const action = form.recordId ? 'update' : 'create';
      const can = async (operation: 'read' | 'write') => {
        try {
          if (resource === 'transport_runs')
            await this.scopes.assertRunFormAccess(form.recordId, null, operation, actor);
          else await this.scopes.assertShipmentFormAccess(form.recordId, companyId, null, operation, actor);
          return true;
        } catch (error) {
          if (error instanceof ProcessDocumentsError && /_(ACCESS_DENIED|NOT_FOUND)$/.test(error.code)) return false;
          throw error;
        }
      };
      const canRead = (form.recordId !== null || !!context.can?.({ resource, action })) && (await can('read'));
      const canWrite = canRead && !!context.can?.({ resource, action }) && (await can('write'));
      context.body = { canRead, canWrite };
      await next();
    });
  };

  private shipmentCompany(context: Context, form: FormDocumentSaveTarget): string | null {
    if (form.resource !== 'shipments' || form.recordId || context.query.companyId === undefined) return null;
    const companyId = documentRecordId(context.query.companyId);
    if (!companyId) throw new ProcessDocumentsError('INVALID_DOCUMENT_SCOPE', 'Не удалось определить компанию.');
    return companyId;
  }

  private readonly stage = async (context: UploadContext, next: Next) => {
    this.assertPost(context);
    await this.handle(context, async (actor) => {
      const { resource, recordId, folderId } = context.query;
      const form = this.form(context, resource, recordId ?? null);
      const supportsFolders = supportsFormFolderUploads(form.resource);
      if (
        folderId !== undefined &&
        (!supportsFolders || !form.recordId || typeof folderId !== 'string' || !/^[\w-]{1,128}$/.test(folderId))
      ) {
        throw new ProcessDocumentsError('INVALID_DOCUMENT_SCOPE', 'Не удалось определить папку записи.');
      }
      if (!context.can?.({ resource: form.resource, action: form.recordId === null ? 'create' : 'update' })) {
        context.throw(403, 'Нет права сохранять эту форму.');
      }
      if (form.resource === 'shipments') {
        await this.scopes.assertShipmentFormAccess(
          form.recordId,
          this.shipmentCompany(context, form),
          typeof folderId === 'string' ? folderId : null,
          'write',
          actor,
        );
      }
      if (form.resource === 'transport_runs') {
        await this.scopes.assertRunFormAccess(
          form.recordId,
          typeof folderId === 'string' ? folderId : null,
          'write',
          actor,
        );
      }
      if (context.request.length == null || context.request.length > documentUploadRequestBytes) {
        context.throw(413, 'Размер запроса загрузки неизвестен или превышает допустимый.');
      }
      const policy =
        form.resource === 'permit_documents'
          ? { ...processDocumentUpload, allowNativeFormats: true }
          : processDocumentUpload;
      context.body = await this.drafts.stage(
        actor.userId,
        form,
        async (directory) => {
          const receive = multer({
            dest: directory,
            preservePath: true,
            limits: {
              files: processDocumentUpload.maxFiles,
              fileSize: policy.maxFileBytes + 1,
              fields: supportsFolders ? 2 : 1,
              fieldSize: documentUploadFieldBytes,
            },
          }).array('files');
          await receive(context, async () => undefined);
          const files = context.files ?? [];
          const body = context.request.body;
          const emptyFolders = parseUploadedEmptyFolders(
            body && typeof body === 'object' && 'emptyFolders' in body ? body.emptyFolders : undefined,
          );
          emptyFolders?.forEach(assertSafeUploadName);
          validateUploadBatch(files, processDocumentUpload);
          const filePaths = resolveUploadedFilePaths(
            body && typeof body === 'object' && 'filePaths' in body ? body.filePaths : undefined,
            files,
          );
          const verified: UploadedDocumentFile[] = [];
          for (const [index, file] of files.entries()) {
            const originalName = filePaths[index];
            assertSafeUploadName(originalName);
            verified.push({
              path: file.path,
              originalName,
              size: file.size,
              mimeType: await inspectUpload({ path: file.path, originalName, size: file.size }, policy),
            });
          }
          return { files: verified, emptyFolders };
        },
        typeof folderId === 'string' ? folderId : undefined,
      );
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

  private readonly editFile = async (context: Context, next: Next) => {
    this.assertPost(context);
    await this.handle(context, async (actor) => {
      const body = context.request.body;
      if (!body || typeof body !== 'object' || !('token' in body) || !('fileId' in body) || !('title' in body)) {
        return context.throw(400, 'Не удалось определить временный файл.');
      }
      const { token, fileId, title } = body;
      if (
        typeof token !== 'string' ||
        !tokenPattern.test(token) ||
        typeof fileId !== 'string' ||
        !tokenPattern.test(fileId) ||
        (title !== null && (typeof title !== 'string' || title.length > 200))
      ) {
        return context.throw(400, 'Недопустимые параметры временного файла.');
      }
      context.body = {
        batch: await this.drafts.editFile(actor.userId, token, fileId, typeof title === 'string' ? title : null),
      };
      await next();
    });
  };

  private async publishWorkspaceShipmentDrafts(context: WorkspaceDraftContext, next: Next): Promise<void> {
    const action = context.action;
    const values: unknown = action?.params?.values;
    if (
      action?.resourceName !== 'transport_runs' ||
      !['create', 'update'].includes(action.actionName) ||
      !values ||
      typeof values !== 'object' ||
      !('shipments' in values) ||
      !Array.isArray(values.shipments)
    )
      return this.publishOnSave(context, next);

    const draftRows = values.shipments
      .map(shipmentDraftTokens)
      .filter((tokens) => tokens !== undefined && (!Array.isArray(tokens) || tokens.length > 0));
    if (!draftRows.length) return this.publishOnSave(context, next);

    await this.handle(context, async (actor) => {
      const ids = new Map<string, string>();
      const batches: Array<{ key: string; batch: ReturnType<TemporaryDocumentDrafts['acquire']> }> = [];
      let saved = false;
      context[captureWorkspaceShipment] = (tokens, id) => ids.set(this.tokens(tokens).join(','), id);
      try {
        for (const rawTokens of draftRows) {
          if (Array.isArray(rawTokens) && rawTokens.includes(FORM_DOCUMENT_DRAFT_PENDING)) {
            context.throw(409, 'Дождитесь загрузки документов поставок и сохраните рейс снова.');
          }
          const tokens = this.tokens(rawTokens);
          const batch = this.drafts.acquire(tokens, actor.userId, { resource: 'shipments', recordId: null });
          batches.push({ key: tokens.join(','), batch });
        }
        this.ensureHook('transport_runs');
        this.workspaceCommits.set(context, async (_runId, transaction) => {
          for (const { key, batch } of batches) {
            const id = ids.get(key);
            if (!id)
              throw new ProcessDocumentsError('FORM_DRAFT_BUSY', 'Не удалось сохранить черновик вместе с поставкой.');
            for (const destination of batch.destinations) {
              await this.publish.execute(
                {
                  resource: 'shipments',
                  recordId: id,
                  ...destination,
                  actor: { ...actor, creatingOwner: { resource: 'shipments', recordId: id } },
                },
                {
                  transaction,
                  onRollback: (cleanup) => this.plugin.db.once(`transactionRollback:${transaction.id}`, cleanup),
                },
              );
            }
          }
          transaction.afterCommit(() => {
            saved = true;
          });
        });
        await this.publishOnSave(context, next);
        if (!saved && context.status < 400) context.throw(409, 'Не удалось сохранить черновики поставок.');
      } finally {
        this.workspaceCommits.delete(context);
        delete context[captureWorkspaceShipment];
        await Promise.all(batches.map(({ batch }) => batch.release(saved)));
      }
    });
  }

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
        for (const destination of batch.destinations) {
          await this.publish.execute(
            {
              resource: form.resource,
              recordId,
              ...destination,
              actor:
                form.recordId === null ? { ...actor, creatingOwner: { resource: form.resource, recordId } } : actor,
            },
            {
              transaction,
              onRollback: (cleanup) => this.plugin.db.once(`transactionRollback:${transaction.id}`, cleanup),
            },
          );
        }
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
        const workspaceCommit = resource === 'transport_runs' ? this.workspaceCommits.get(options.context) : undefined;
        if (!commit && !workspaceCommit) return;
        const id = documentRecordId(record.get('id'));
        if (!options.transaction || !id) {
          throw new ProcessDocumentsError('FORM_DRAFT_BUSY', 'Не удалось сохранить файлы вместе с записью.');
        }
        await workspaceCommit?.(id, options.transaction);
        await commit?.(id, options.transaction);
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
