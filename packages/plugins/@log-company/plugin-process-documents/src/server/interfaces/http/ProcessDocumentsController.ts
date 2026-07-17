import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { Context, Next } from '@nocobase/actions';
import type { Plugin } from '@nocobase/server';
import { koaMulter as multer } from '@nocobase/utils';
import { AttachDraftDocumentsToProcess } from '../../application/AttachDraftDocumentsToProcess';
import { CreateProcessDocumentFolder } from '../../application/CreateProcessDocumentFolder';
import { DeleteProcessDocument } from '../../application/DeleteProcessDocument';
import { DeleteProcessDocumentFolder } from '../../application/DeleteProcessDocumentFolder';
import { DownloadProcessDocument } from '../../application/DownloadProcessDocument';
import { GetProcessDocumentFolderDeleteSummary } from '../../application/GetProcessDocumentFolderDeleteSummary';
import { ListProcessDocuments } from '../../application/ListProcessDocuments';
import { UploadProcessDocuments, type UploadedDocumentFile } from '../../application/UploadProcessDocuments';
import type { ApplicationLogger } from '../../application/ports/DocumentStorage';
import type {
  DocumentActor,
  DocumentFolderRecord,
  ProcessDocumentRecord,
} from '../../application/ports/ProcessDocumentsRepository';
import { ProcessDocumentsError, type ProcessDocumentsErrorCode } from '../../domain/documents/DocumentErrors';
import { normalizeNullableIdentifier, parseDraftToken, parseIdentifier } from '../../domain/documents/DocumentScope';

const RESOURCE = 'processDocuments';
const DRAFT_FORM_FIELD = '_processDocumentsDraftToken';

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
  folderDeleteSummary: GetProcessDocumentFolderDeleteSummary;
  deleteFolder: DeleteProcessDocumentFolder;
  attachDraftDocuments: AttachDraftDocumentsToProcess;
}

export class ProcessDocumentsController {
  private readonly upload = multer({
    dest: path.join(os.tmpdir(), 'process-documents-upload'),
    preservePath: true,
  }).array('files');

  constructor(
    private readonly plugin: Plugin,
    private readonly actions: ProcessDocumentsActions,
    private readonly logger: ApplicationLogger,
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
        folderDeleteSummary: this.folderDeleteSummary,
        deleteFolder: this.deleteFolder,
      },
    });
    this.plugin.app.acl.allow(RESOURCE, '*', 'loggedIn');
  }

  private readonly list = async (context: Context, next: Next): Promise<void> => {
    await this.handle(context, async () => {
      const values = this.actionValues(context);
      const result = await this.actions.list.execute({
        processId: parseIdentifier(values.processId),
        draftToken: this.draftToken(values),
        folderId: normalizeNullableIdentifier(values.folderId),
        actor: this.actor(context),
      });
      context.body = {
        ...result,
        folders: result.folders.map((folder) => this.serializeFolder(folder)),
        files: result.files.map((document) => this.serializeDocument(document)),
      };
      await next();
    });
  };

  private readonly createFolder = async (context: Context, next: Next): Promise<void> => {
    await this.handle(context, async () => {
      const values = this.actionValues(context);
      const folder = await this.actions.createFolder.execute({
        processId: parseIdentifier(values.processId),
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
      await this.upload(context, async () => undefined);
      const files = context.files || [];
      try {
        const values = this.actionValues(context);
        const result = await this.actions.uploadFiles.execute({
          processId: parseIdentifier(values.processId),
          draftToken: this.draftToken(values),
          folderId: normalizeNullableIdentifier(values.folderId),
          files: files.map(
            (file): UploadedDocumentFile => ({
              path: file.path,
              originalName: file.originalname,
              mimeType: file.mimetype || 'application/octet-stream',
              size: file.size,
            }),
          ),
          actor: this.actor(context),
        });
        context.body = {
          folders: result.folders.map((folder) => this.serializeFolder(folder)),
          files: result.files.map((document) => this.serializeDocument(document)),
        };
        await next();
      } finally {
        await this.removeTemporaryFiles(files);
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
      context.set('Content-Type', result.mimeType);
      context.set('Content-Length', String(result.size));
      context.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`);
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
      isRoot: roles.includes('root'),
      authorizationContext: context,
    };
  }

  private draftToken(values: Record<string, unknown>): string | null {
    return parseDraftToken(values.draftToken ?? values.draft_token ?? values[DRAFT_FORM_FIELD]);
  }

  private requiredIdentifier(value: unknown, code: ProcessDocumentsErrorCode, message: string): string {
    const identifier = parseIdentifier(value);
    if (!identifier) {
      throw new ProcessDocumentsError(code, message);
    }
    return identifier;
  }

  private serializeFolder(folder: DocumentFolderRecord) {
    return {
      id: folder.id,
      title: folder.title,
      process_id: folder.processId,
      draft_token: folder.draftToken,
      parent_folder_id: folder.parentFolderId,
      createdById: folder.createdById,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
      type: 'folder',
      author: folder.author || '',
    };
  }

  private serializeDocument(document: ProcessDocumentRecord) {
    return {
      id: document.id,
      title: document.title,
      original_filename: document.originalFilename,
      process_id: document.processId,
      draft_token: document.draftToken,
      folder_id: document.folderId,
      storage_key: document.storageKey,
      mime_type: document.mimeType,
      file_size: document.fileSize,
      createdById: document.createdById,
      createdAt: document.createdAt,
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
    try {
      await work();
    } catch (error) {
      if (error instanceof ProcessDocumentsError) {
        context.throw(this.statusFor(error.code), error.message);
      }
      throw error;
    }
  }

  private statusFor(code: ProcessDocumentsErrorCode): number {
    if (code === 'PROCESS_ACCESS_DENIED' || code === 'DRAFT_ACCESS_DENIED') {
      return 403;
    }
    if (code === 'PROCESS_NOT_FOUND' || code === 'FOLDER_NOT_FOUND' || code === 'DOCUMENT_NOT_FOUND') {
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
