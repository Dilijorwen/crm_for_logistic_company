/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { documentStorageOwnerPath } from './documentStorageOwnerPath';
import { MAX_DOCUMENT_UPLOAD_ENTRIES } from '../../contracts/processDocuments';
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
  TransactionContext,
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
  emptyFolders?: string[];
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

  async assertDestination(input: Omit<UploadProcessDocumentsInput, 'files'>, transaction?: TransactionContext) {
    const scope = await this.scopeService.resolve({ ...input, operation: 'write' }, transaction);
    await this.scopeService.requireFolder(input.folderId, scope, transaction);
    await this.scopeService.assertFolderAccess(input.folderId, scope, 'write', input.actor, transaction);
    return scope;
  }

  async execute(
    input: UploadProcessDocumentsInput,
    outer?: { transaction: TransactionContext; onRollback(cleanup: () => Promise<void>): void },
  ): Promise<UploadProcessDocumentsResult> {
    const emptyFolders = input.emptyFolders ?? [];
    if (!input.files.length && !emptyFolders.length) {
      throw new ProcessDocumentsError('FILES_REQUIRED', 'Файлы не выбраны.');
    }

    for (const file of input.files) assertSafeUploadName(file.originalName);
    if (input.files.length + emptyFolders.length > MAX_DOCUMENT_UPLOAD_ENTRIES) {
      throw new ProcessDocumentsError(
        'INVALID_UPLOAD',
        `Можно загрузить не более ${MAX_DOCUMENT_UPLOAD_ENTRIES} файлов и папок за раз.`,
      );
    }
    for (const folder of emptyFolders) assertSafeUploadName(folder);

    const scope = await this.assertDestination(input, outer?.transaction);
    const storedKeys: string[] = [];

    const persist = async (transaction: TransactionContext) => {
      if (scope.mode === 'shipment' && !(await this.repository.shipmentExists(scope.shipmentId, transaction))) {
        throw new ProcessDocumentsError('SHIPMENT_NOT_FOUND', 'Поставка не найдена.');
      }
      const createdFolders: DocumentFolderRecord[] = [];
      const createdFiles: ProcessDocumentRecord[] = [];
      const folderCache = new Map<string, string>();
      for (const name of emptyFolders) {
        const path = name.split(/[\\/]/).map((part) => part.trim());
        const uploadedFolder = await this.folderService.createPath(
          scope,
          input.folderId,
          path,
          input.actor,
          folderCache,
          transaction,
        );
        createdFolders.push(...uploadedFolder.created);
      }

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
          throw new ProcessDocumentsError('STORAGE_UPLOAD_FAILED', 'Не удалось загрузить файл в хранилище документов.');
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
    };
    const compensate = async () => {
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
    };
    try {
      if (!outer) return await this.repository.withTransaction(persist);
      const result = await persist(outer.transaction);
      outer.onRollback(compensate);
      return result;
    } catch (error) {
      await compensate();
      throw error;
    }
  }
}
