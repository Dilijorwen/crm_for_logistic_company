import { createUniqueDocumentName, splitRelativeDocumentName } from '../domain/documents/DocumentName';
import { ProcessDocumentsError } from '../domain/documents/DocumentErrors';
import { DocumentFolderService } from './DocumentFolderService';
import { DocumentScopeService } from './DocumentScopeService';
import type {
  ApplicationLogger,
  DocumentStorage,
  IdentifierGenerator,
  StorageKeyGenerator,
} from './ports/DocumentStorage';
import type {
  DocumentActor,
  DocumentFolderRecord,
  ProcessDocumentRecord,
  ProcessDocumentsRepository,
} from './ports/ProcessDocumentsRepository';

export interface UploadedDocumentFile {
  path: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface UploadProcessDocumentsInput {
  processId: string | null;
  draftToken: string | null;
  folderId: string | null;
  files: UploadedDocumentFile[];
  actor: DocumentActor;
}

export interface UploadProcessDocumentsResult {
  folders: DocumentFolderRecord[];
  files: ProcessDocumentRecord[];
}

export class UploadProcessDocuments {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly storage: DocumentStorage,
    private readonly storageKeyGenerator: StorageKeyGenerator,
    private readonly identifierGenerator: IdentifierGenerator,
    private readonly scopeService: DocumentScopeService,
    private readonly folderService: DocumentFolderService,
    private readonly logger: ApplicationLogger,
  ) {}

  async execute(input: UploadProcessDocumentsInput): Promise<UploadProcessDocumentsResult> {
    if (!input.files.length) {
      throw new ProcessDocumentsError('FILES_REQUIRED', 'Файлы не выбраны.');
    }

    const scope = await this.scopeService.resolve({ ...input, operation: 'write' });
    await this.scopeService.requireFolder(input.folderId, scope);
    const storedKeys: string[] = [];

    try {
      return await this.repository.withTransaction(async (transaction) => {
        const createdFolders: DocumentFolderRecord[] = [];
        const createdFiles: ProcessDocumentRecord[] = [];
        const folderCache = new Map<string, string>();

        for (const file of input.files) {
          const { folders, filename } = splitRelativeDocumentName(file.originalName);
          const uploadFolder = await this.folderService.createPath(
            scope,
            input.folderId,
            folders,
            input.actor,
            folderCache,
            transaction,
          );
          createdFolders.push(...uploadFolder.created);

          const existingTitles = await this.repository.listDocumentTitles(scope, uploadFolder.folderId, transaction);
          const title = createUniqueDocumentName(filename, existingTitles, true);
          const ownerPath = scope.mode === 'process' ? scope.processId : `drafts/${scope.draftToken}`;
          const storageKey = this.storageKeyGenerator.generate(ownerPath, filename);

          try {
            await this.storage.store({
              key: storageKey,
              filePath: file.path,
              size: file.size,
              contentType: file.mimeType,
            });
            storedKeys.push(storageKey);
          } catch (error) {
            this.logger.error('Не удалось загрузить объект в хранилище документов', error, { storageKey });
            throw new ProcessDocumentsError(
              'STORAGE_UPLOAD_FAILED',
              'Не удалось загрузить файл в хранилище документов.',
            );
          }

          createdFiles.push(
            await this.repository.createDocument(
              {
                id: this.identifierGenerator.generate(),
                title,
                originalFilename: filename,
                scope,
                folderId: uploadFolder.folderId,
                storageKey,
                mimeType: file.mimeType || 'application/octet-stream',
                fileSize: file.size,
                actorId: input.actor.userId,
              },
              transaction,
            ),
          );
        }

        return { folders: createdFolders, files: createdFiles };
      });
    } catch (error) {
      await Promise.all(
        storedKeys.map(async (storageKey) => {
          try {
            await this.storage.delete(storageKey);
          } catch (compensationError) {
            this.logger.error('Не удалось удалить объект после отката загрузки документа', compensationError, {
              storageKey,
            });
          }
        }),
      );
      throw error;
    }
  }
}
