/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { Context, Next } from '@nocobase/actions';
import type { Plugin } from '@nocobase/server';
import { koaMulter as multer } from '@nocobase/utils';
import {
  FileStorageError,
  InvalidUploadError,
  fileResponseHeaders,
  inspectUpload,
  processDocumentUpload,
  validateUploadBatch,
} from '@log-company/plugin-file-storage';
import { SetDocumentFolderAccess } from '../../application/SetDocumentFolderAccess';
import { documentRights, documentSections } from '../../../contracts/processDocuments';
import type { DocumentAccessRule, DocumentSection, FolderAccess } from '../../../contracts/processDocuments';
import type { DocumentSectionAccess } from '../../application/DocumentSectionAccess';
import type { NocoBaseProcessDocumentAccess } from '../../infrastructure/nocobase/NocoBaseProcessDocumentAccess';
import { documentSectionRulesCollection } from '../../collections/processDocumentSectionRules';
import { AttachDraftDocumentsToProcess } from '../../application/AttachDraftDocumentsToProcess';
import { CreateProcessDocumentFolder } from '../../application/CreateProcessDocumentFolder';
import { DeleteProcessDocument } from '../../application/DeleteProcessDocument';
import { DeleteProcessDocumentFolder } from '../../application/DeleteProcessDocumentFolder';
import { DeleteRecordAttachment } from '../../application/DeleteRecordAttachment';
import { DownloadProcessDocument } from '../../application/DownloadProcessDocument';
import { GetProcessDocumentFolderDeleteSummary } from '../../application/GetProcessDocumentFolderDeleteSummary';
import { ListProcessDocuments } from '../../application/ListProcessDocuments';
import { UploadProcessDocuments } from '../../application/UploadProcessDocuments';
import type { UploadedDocumentFile } from '../../application/UploadProcessDocuments';
import type { ApplicationLogger } from '../../application/ports/DocumentStorage';
import type {
  DocumentActor,
  DocumentFolderRecord,
  ProcessDocumentRecord,
} from '../../application/ports/ProcessDocumentsRepository';
import { ProcessDocumentsError } from '../../domain/documents/DocumentErrors';
import type { ProcessDocumentsErrorCode } from '../../domain/documents/DocumentErrors';
import { normalizeNullableIdentifier, parseDraftToken, parseIdentifier } from '../../domain/documents/DocumentScope';

import { PROCESS_DOCUMENTS_DRAFT_FIELD } from '../../../contracts/processDocuments';
import type { DocumentsListResponse } from '../../../contracts/processDocuments';

import { decodeUploadedName } from './UploadedDocumentName';

const RESOURCE = 'processDocuments';

interface UploadedFile {
  path: string;
  originalname: string;
  mimetype?: string;
  size: number;
}

type UploadContext = Context & { files?: UploadedFile[] };

export interface ProcessDocumentsActions {
  list: ListProcessDocuments;
  createFolder: CreateProcessDocumentFolder;
  uploadFiles: UploadProcessDocuments;
  download: DownloadProcessDocument;
  deleteFile: DeleteProcessDocument;
  deleteAttachment: DeleteRecordAttachment;
  folderDeleteSummary: GetProcessDocumentFolderDeleteSummary;
  deleteFolder: DeleteProcessDocumentFolder;
  attachDraftDocuments: AttachDraftDocumentsToProcess;
  setFolderAccess: SetDocumentFolderAccess;
}

export class ProcessDocumentsController {
  private readonly upload = multer({
    dest: path.join(os.tmpdir(), 'process-documents-upload'),
    preservePath: true,
    limits: { files: processDocumentUpload.maxFiles, fileSize: processDocumentUpload.maxFileBytes, fields: 8 },
  }).array('files');

  constructor(
    private readonly plugin: Plugin,
    private readonly actions: ProcessDocumentsActions,
    private readonly logger: ApplicationLogger,
    private readonly access: NocoBaseProcessDocumentAccess,
    private readonly sectionAccess: DocumentSectionAccess,
  ) {}

  register(): void {
    this.plugin.app.resourceManager.define({
      name: RESOURCE,
      actions: {
        list: this.list,
        createFolder: this.createFolder,
        uploadFiles: this.uploadFiles,
        download: this.download,
        deleteFile: this.deleteFile,
        deleteAttachment: this.deleteAttachment,
        folderDeleteSummary: this.folderDeleteSummary,
        deleteFolder: this.deleteFolder,
        setFolderAccess: this.setFolderAccess,
        sectionPermissions: this.sectionPermissions,
        attachmentPermissions: this.attachmentPermissions,
        getSectionAccess: this.getSectionAccess,
        setSectionAccess: this.setSectionAccess,
      },
    });
    for (const action of [
      'list',
      'createFolder',
      'uploadFiles',
      'download',
      'deleteFile',
      'deleteAttachment',
      'folderDeleteSummary',
      'deleteFolder',
      'setFolderAccess',
      'sectionPermissions',
      'attachmentPermissions',
      'getSectionAccess',
      'setSectionAccess',
    ]) {
      this.plugin.app.acl.allow(RESOURCE, action, 'loggedIn');
    }
    this.plugin.app.resourceManager.use(
      async (context, next) => {
        const resource = context.action?.resourceName;
        const name = resource?.split('.').pop();
        if (
          ['process_documents', 'process_document_folders', documentSectionRulesCollection].includes(name || '') &&
          !this.actor(context as Context).isRoot
        ) {
          context.throw(403, 'Откройте документы через файловый менеджер.');
        }
        const section = this.attachmentSection(resource);
        if (section && context.action) {
          const action = context.action.actionName;
          const operation = ['list', 'get'].includes(action)
            ? 'read'
            : ['remove', 'destroy'].includes(action)
              ? 'delete'
              : 'write';
          await this.handle(context as Context, async () => {
            const id = this.ownerId(context.action?.sourceId);
            if (!id) throw new ProcessDocumentsError('INVALID_DOCUMENT_SCOPE', 'Укажите карточку документа.');
            await this.access.assertAttachmentSection(section, id, operation, this.actor(context as Context));
          });
        }
        await next();
      },
      { tag: 'process-document-private-records', after: 'acl' },
    );
  }

  private readonly list = async (context: Context, next: Next): Promise<void> => {
    await this.handle(context, async () => {
      const values = this.actionValues(context);
      const result = await this.actions.list.execute({
        ...this.owner(values),
        shipmentId: parseIdentifier(values.shipmentId),
        draftToken: this.draftToken(values),
        folderId: normalizeNullableIdentifier(values.folderId),
        actor: this.actor(context),
      });
      const body: DocumentsListResponse = {
        ...result,
        currentFolder: result.currentFolder
          ? this.serializeFolder(result.currentFolder, result.permissions.canManageAccess)
          : null,
        folders: result.folders.map((folder) => this.serializeFolder(folder, result.permissions.canManageAccess)),
        files: result.files.map((document) => this.serializeDocument(document)),
      };
      context.body = body;
      await next();
    });
  };

  private readonly createFolder = async (context: Context, next: Next): Promise<void> => {
    await this.handle(context, async () => {
      const values = this.actionValues(context);
      const folder = await this.actions.createFolder.execute({
        ...this.owner(values),
        shipmentId: parseIdentifier(values.shipmentId),
        draftToken: this.draftToken(values),
        parentFolderId: normalizeNullableIdentifier(values.parentFolderId ?? values.parent_folder_id),
        title: String(values.title || ''),
        actor: this.actor(context),
      });
      context.body = this.serializeFolder(folder);
      await next();
    });
  };

  private readonly uploadFiles = async (context: UploadContext, next: Next): Promise<void> => {
    await this.handle(context, async () => {
      try {
        await this.upload(context, async () => undefined);
        const files = context.files || [];
        const values = this.actionValues(context);
        validateUploadBatch(files, processDocumentUpload);
        const verifiedFiles: UploadedDocumentFile[] = [];
        for (const file of files) {
          const originalName = decodeUploadedName(file.originalname);
          verifiedFiles.push({
            path: file.path,
            originalName,
            mimeType: await inspectUpload({ path: file.path, originalName, size: file.size }, processDocumentUpload),
            size: file.size,
          });
        }
        const result = await this.actions.uploadFiles.execute({
          ...this.owner(values),
          shipmentId: parseIdentifier(values.shipmentId),
          draftToken: this.draftToken(values),
          folderId: normalizeNullableIdentifier(values.folderId),
          files: verifiedFiles,
          actor: this.actor(context),
        });
        context.body = {
          folders: result.folders.map((folder) => this.serializeFolder(folder)),
          files: result.files.map((document) => this.serializeDocument(document)),
        };
        await next();
      } finally {
        await this.removeTemporaryFiles(context.files || []);
      }
    });
  };

  private readonly download = async (context: Context, next: Next): Promise<void> => {
    await this.handle(context, async () => {
      const values = this.actionValues(context);
      const result = await this.actions.download.execute({
        documentId: this.requiredIdentifier(
          values.documentId ?? values.id,
          'DOCUMENT_NOT_FOUND',
          'Документ не найден.',
        ),
        draftToken: this.draftToken(values),
        actor: this.actor(context),
      });
      const headers = fileResponseHeaders({
        fileName: result.filename,
        mimeType: 'application/octet-stream',
        size: result.size,
      });
      for (const [name, value] of Object.entries(headers)) context.set(name, value);
      context.body = result.content;
      await next();
    });
  };

  private readonly deleteFile = async (context: Context, next: Next): Promise<void> => {
    await this.handle(context, async () => {
      const values = this.actionValues(context);
      await this.actions.deleteFile.execute({
        documentId: this.requiredIdentifier(
          values.documentId ?? values.id,
          'DOCUMENT_NOT_FOUND',
          'Документ не найден.',
        ),
        draftToken: this.draftToken(values),
        actor: this.actor(context),
      });
      context.body = true;
      await next();
    });
  };

  private readonly folderDeleteSummary = async (context: Context, next: Next): Promise<void> => {
    await this.handle(context, async () => {
      const values = this.actionValues(context);
      context.body = await this.actions.folderDeleteSummary.execute({
        folderId: this.requiredIdentifier(
          values.folderId ?? values.id,
          'FOLDER_NOT_FOUND',
          'Папка документов не найдена.',
        ),
        draftToken: this.draftToken(values),
        actor: this.actor(context),
      });
      await next();
    });
  };

  private readonly deleteFolder = async (context: Context, next: Next): Promise<void> => {
    await this.handle(context, async () => {
      const values = this.actionValues(context);
      await this.actions.deleteFolder.execute({
        folderId: this.requiredIdentifier(
          values.folderId ?? values.id,
          'FOLDER_NOT_FOUND',
          'Папка документов не найдена.',
        ),
        draftToken: this.draftToken(values),
        actor: this.actor(context),
      });
      context.body = true;
      await next();
    });
  };

  private readonly setFolderAccess = async (context: Context, next: Next): Promise<void> => {
    await this.handle(context, async () => {
      const values = this.actionValues(context);
      const folderId = this.requiredIdentifier(values.folderId, 'FOLDER_NOT_FOUND', 'Папка не найдена.');
      await this.actions.setFolderAccess.execute(folderId, this.parseGrants(values.grants), this.actor(context));
      context.body = true;
      await next();
    });
  };

  private readonly sectionPermissions = async (context: Context, next: Next): Promise<void> => {
    await this.handle(context, async () => {
      const companyId = this.ownerId(this.actionValues(context).companyId);
      context.body = await this.access.sectionPermissions(companyId, this.actor(context));
      await next();
    });
  };

  private readonly attachmentPermissions = async (context: Context, next: Next): Promise<void> => {
    await this.handle(context, async () => {
      const values = this.actionValues(context);
      const section = this.attachmentSection(values.resource);
      const id = this.ownerId(values.recordId);
      if (!section || !id) throw new ProcessDocumentsError('INVALID_DOCUMENT_SCOPE', 'Укажите карточку документа.');
      context.body = await this.access.attachmentPermissions(section, id, this.actor(context));
      await next();
    });
  };

  private readonly getSectionAccess = async (context: Context, next: Next): Promise<void> => {
    await this.handle(context, async () => {
      this.assertSettingsAccess(context);
      const { section, companyId } = this.sectionTarget(this.actionValues(context));
      if (companyId) await this.access.assertCompanyRecord(companyId, 'read', this.actor(context));
      context.body = await this.sectionAccess.get(section, companyId);
      await next();
    });
  };

  private readonly setSectionAccess = async (context: Context, next: Next): Promise<void> => {
    await this.handle(context, async () => {
      if (context.method !== 'POST') context.throw(405);
      this.assertSettingsAccess(context);
      const values = this.actionValues(context);
      const { section, companyId } = this.sectionTarget(values);
      if (companyId) await this.access.assertCompanyRecord(companyId, 'read', this.actor(context));
      await this.sectionAccess.save(section, companyId, this.parseSectionRules(values.rules));
      context.body = true;
      await next();
    });
  };

  private assertSettingsAccess(context: Context) {
    if (!this.actor(context).isRoot) {
      throw new ProcessDocumentsError('DOCUMENT_ACCESS_DENIED', 'Настройка доступа доступна администратору.');
    }
  }

  private sectionTarget(values: Record<string, unknown>) {
    const section = documentSections.find((item) => item === values.section);
    if (!section) throw new ProcessDocumentsError('INVALID_DOCUMENT_SCOPE', 'Укажите раздел документов.');
    return { section, companyId: this.ownerId(values.companyId) };
  }

  private parseSectionRules(value: unknown): DocumentAccessRule[] {
    if (!Array.isArray(value) || value.length > 1000) {
      throw new ProcessDocumentsError('INVALID_FOLDER_ACCESS', 'Неверный список разрешений.');
    }
    const subjects = new Set<string>();
    return value.map((item) => {
      const { kind, subject, rights } = this.asRecord(item);
      const entries = Object.entries(this.asRecord(rights));
      if (
        (kind !== 'role' && kind !== 'user') ||
        typeof subject !== 'string' ||
        !(kind === 'role' ? /^[a-zA-Z0-9_.-]{1,128}$/ : /^[1-9][0-9]{0,18}$/).test(subject) ||
        subjects.has(`${kind}:${subject}`) ||
        !entries.length ||
        entries.some(
          ([key, permission]) => !documentRights.some((right) => right === key) || typeof permission !== 'boolean',
        )
      )
        throw new ProcessDocumentsError('INVALID_FOLDER_ACCESS', 'Неверная роль, пользователь или право.');
      subjects.add(`${kind}:${subject}`);
      return { kind, subject, rights: Object.fromEntries(entries) };
    });
  }

  private readonly deleteAttachment = async (context: Context, next: Next): Promise<void> => {
    await this.handle(context, async () => {
      if (context.method !== 'POST') context.throw(405);
      const dataSource = context.get('x-data-source');
      if (dataSource && dataSource !== 'main') context.throw(400, 'Вложения доступны только в основном источнике.');
      const values = this.asRecord(context.request.body);
      const section = this.attachmentSection(`${values.collection}.${values.field}`);
      if (section) {
        const id = this.ownerId(values.recordId);
        if (!id) throw new ProcessDocumentsError('INVALID_DOCUMENT_SCOPE', 'Укажите карточку документа.');
        await this.access.assertAttachmentSection(section, id, 'delete', this.actor(context));
      }
      await this.actions.deleteAttachment.execute(values, this.actor(context));
      context.body = true;
      await next();
    });
  };

  private parseGrants(value: unknown): FolderAccess | null {
    if (value === null) return null;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const { rules, defaultAllow } = this.asRecord(value);
      return { rules: this.parseSectionRules(rules), ...(defaultAllow === false && { defaultAllow }) };
    }
    if (!Array.isArray(value) || value.length > 100) {
      throw new ProcessDocumentsError('INVALID_FOLDER_ACCESS', 'Неверный список разрешений.');
    }
    return value.map((item) => {
      const { kind, subject, level } = this.asRecord(item);
      if (
        (kind !== 'role' && kind !== 'user') ||
        typeof subject !== 'string' ||
        !(kind === 'role' ? /^[a-zA-Z0-9_.-]{1,128}$/ : /^[1-9][0-9]{0,18}$/).test(subject) ||
        (level !== 'read' && level !== 'write' && level !== 'delete')
      ) {
        throw new ProcessDocumentsError('INVALID_FOLDER_ACCESS', 'Неверная роль, пользователь или уровень доступа.');
      }
      return { kind, subject, level };
    });
  }

  private actionValues(context: Context): Record<string, unknown> {
    const request = this.asRecord(context.request);
    return {
      ...this.asRecord(request.body),
      ...this.asRecord(context.action?.params?.values),
      ...this.asRecord(context.action?.params),
      ...this.asRecord(context.query),
    };
  }

  private actor(context: Context): DocumentActor {
    const roles = Array.isArray(context.state?.currentRoles) ? context.state.currentRoles.map(String) : [];
    return {
      userId: parseIdentifier(
        context.state?.currentUser?.id ?? context.state?.currentUserId ?? context.state?.user?.id,
      ),
      isRoot: roles.includes('root') || context.state?.currentRole === 'root',
      roles:
        context.state?.currentRole && context.state.currentRole !== 'union'
          ? [String(context.state.currentRole)]
          : roles,
      authorizationContext: context,
    };
  }

  private attachmentSection(resource: unknown): Extract<DocumentSection, 'corporate' | 'permits'> | undefined {
    if (resource === 'permit_documents.documents') return 'permits';
    if (resource === 'our_companies.documents') return 'corporate';
  }

  private ownerId(value: unknown): string | null {
    if (value == null) return null;
    if (
      (typeof value !== 'string' && typeof value !== 'number') ||
      !/^[1-9][0-9]{0,18}$/.test(String(value)) ||
      (String(value).length === 19 && String(value) > '9223372036854775807')
    ) {
      throw new ProcessDocumentsError('INVALID_DOCUMENT_SCOPE', 'Неверный идентификатор компании или рейса.');
    }
    return String(value);
  }

  private owner(values: Record<string, unknown>) {
    const companyId = this.ownerId(values.companyId);
    const runId = this.ownerId(values.runId);
    if (values.companyArea != null && (values.companyArea !== 'company' || !companyId || runId)) {
      throw new ProcessDocumentsError('INVALID_DOCUMENT_SCOPE', 'Укажите папку компании.');
    }
    return { companyId, runId, ...(values.companyArea === 'company' && { companyArea: 'company' as const }) };
  }

  private draftToken(values: Record<string, unknown>): string | null {
    return parseDraftToken(values.draftToken ?? values.draft_token ?? values[PROCESS_DOCUMENTS_DRAFT_FIELD]);
  }

  private requiredIdentifier(value: unknown, code: ProcessDocumentsErrorCode, message: string): string {
    const identifier = parseIdentifier(value);
    if (!identifier) {
      throw new ProcessDocumentsError(code, message);
    }
    return identifier;
  }

  private serializeFolder(folder: DocumentFolderRecord, canManageAccess = false) {
    return {
      id: folder.id,
      title: folder.title,
      shipment_id: folder.shipmentId,
      draft_token: folder.draftToken,
      parent_folder_id: folder.parentFolderId,
      createdById: folder.createdById,
      createdAt: folder.createdAt instanceof Date ? folder.createdAt.toISOString() : folder.createdAt,
      updatedAt: folder.updatedAt,
      type: 'folder',
      ...(canManageAccess ? { grants: folder.grants ?? null } : {}),
      author: folder.author || '',
    };
  }

  private serializeDocument(document: ProcessDocumentRecord) {
    return {
      id: document.id,
      title: document.title,
      original_filename: document.originalFilename,
      shipment_id: document.shipmentId,
      draft_token: document.draftToken,
      folder_id: document.folderId,
      mime_type: document.mimeType,
      file_size: document.fileSize,
      createdById: document.createdById,
      createdAt: document.createdAt instanceof Date ? document.createdAt.toISOString() : document.createdAt,
      updatedAt: document.updatedAt,
      type: 'file',
      author: document.author || '',
    };
  }

  private async removeTemporaryFiles(files: UploadedFile[]): Promise<void> {
    await Promise.all(
      files.map(async (file) => {
        try {
          await fs.unlink(file.path);
        } catch (error) {
          this.logger.warn('Не удалось удалить временный файл загрузки', { path: file.path, error: String(error) });
        }
      }),
    );
  }

  private async handle(context: Context, work: () => Promise<void>): Promise<void> {
    if (!this.actor(context).userId) context.throw(401, 'Войдите в систему.');
    try {
      await work();
    } catch (error) {
      if (error instanceof InvalidUploadError) context.throw(400, error.message);
      if (error instanceof FileStorageError) {
        context.throw(error.code === 'not-found' ? 404 : error.code === 'conflict' ? 409 : 503, error.message);
      }
      if (error instanceof ProcessDocumentsError) {
        context.throw(this.statusFor(error.code), error.message);
      }
      if (error instanceof Error && 'code' in error && String(error.code).startsWith('LIMIT_')) {
        context.throw(413, 'Превышен лимит размера или количества файлов.');
      }
      throw error;
    }
  }

  private statusFor(code: ProcessDocumentsErrorCode): number {
    if (code === 'ATTACHMENT_IN_USE' || code === 'ATTACHMENT_STORAGE_UNSUPPORTED') return 409;
    if (code === 'ATTACHMENT_STORAGE_FAILED') return 503;
    if (code === 'DOCUMENT_ACCESS_DENIED' || code === 'SHIPMENT_ACCESS_DENIED' || code === 'DRAFT_ACCESS_DENIED') {
      return 403;
    }
    if (
      code === 'OWNER_NOT_FOUND' ||
      code === 'SHIPMENT_NOT_FOUND' ||
      code === 'FOLDER_NOT_FOUND' ||
      code === 'DOCUMENT_NOT_FOUND'
    ) {
      return 404;
    }
    return 400;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
