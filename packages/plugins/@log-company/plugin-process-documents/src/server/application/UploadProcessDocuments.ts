/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { documentStorageOwnerPath } from './documentStorageOwnerPath';
import {
  assertSafeUploadName,
  createUniqueDocumentName,
  splitRelativeDocumentName,
} from '../domain/documents/DocumentName';
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

import type { CompanyDocumentTarget } from '../domain/documents/DocumentScope';

export interface UploadProcessDocumentsInput extends CompanyDocumentTarget {
  shipmentId: string | null;
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

    for (const file of input.files) assertSafeUploadName(file.originalName);

    const scope = await this.scopeService.resolve({ ...input, operation: 'write' });
    await this.scopeService.requireFolder(input.folderId, scope);
    await this.scopeService.assertFolderAccess(input.folderId, scope, 'write', input.actor);
    const storedKeys: string[] = [];

    try {
      return await this.repository.withTransaction(async (transaction) => {
        if (scope.mode === 'shipment' && !(await this.repository.shipmentExists(scope.shipmentId, transaction))) {
          throw new ProcessDocumentsError('SHIPMENT_NOT_FOUND', 'Поставка не найдена.');
        }
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
          const ownerPath = documentStorageOwnerPath(scope);
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
