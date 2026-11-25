/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Plugin } from '@nocobase/server';
import PluginFileManager from '@nocobase/plugin-file-manager/server';
import type PluginFileStorage from '@log-company/plugin-file-storage';
import { DeleteRecordAttachment } from '../application/DeleteRecordAttachment';
import { ProcessDocumentsError } from '../domain/documents/DocumentErrors';
import { AttachDraftDocumentsToProcess } from '../application/AttachDraftDocumentsToProcess';
import { CreateProcessDocumentFolder } from '../application/CreateProcessDocumentFolder';
import { DeleteProcessDocument } from '../application/DeleteProcessDocument';
import { DeleteProcessDocumentFolder } from '../application/DeleteProcessDocumentFolder';
import { DeleteProcessDocumentsForProcess } from '../application/DeleteProcessDocumentsForProcess';
import { DocumentFolderService } from '../application/DocumentFolderService';
import { DocumentScopeService } from '../application/DocumentScopeService';
import { DownloadProcessDocument } from '../application/DownloadProcessDocument';
import { DocumentSectionAccess } from '../application/DocumentSectionAccess';
import { GetProcessDocumentFolderDeleteSummary } from '../application/GetProcessDocumentFolderDeleteSummary';
import { GetDocumentFolderConstraints } from '../application/GetDocumentFolderConstraints';
import { SetDocumentFolderAccess } from '../application/SetDocumentFolderAccess';
import { RenameProcessDocumentEntry } from '../application/RenameProcessDocumentEntry';
import { SearchCatalogDocuments } from '../application/SearchCatalogDocuments';
import { NocoBaseCatalogSearch } from '../infrastructure/nocobase/NocoBaseCatalogSearch';
import { ListProcessDocuments } from '../application/ListProcessDocuments';
import { UploadProcessDocuments } from '../application/UploadProcessDocuments';
import { PublishFormDocuments } from '../application/PublishFormDocuments';
import { ValidateDocumentFolderPlacement } from '../application/ValidateDocumentFolderPlacement';
import { ValidateProcessDocumentPlacement } from '../application/ValidateProcessDocumentPlacement';
import { NocoBaseApplicationLogger } from '../infrastructure/nocobase/NocoBaseApplicationLogger';
import { NocoBaseIdentifierGenerator } from '../infrastructure/nocobase/NocoBaseIdentifierGenerator';
import { NocoBaseProcessDocumentAccess } from '../infrastructure/nocobase/NocoBaseProcessDocumentAccess';
import { NocoBaseDocumentSectionRules } from '../infrastructure/nocobase/NocoBaseDocumentSectionRules';
import { NocoBaseRecordAttachmentRepository } from '../infrastructure/nocobase/NocoBaseRecordAttachmentRepository';
import { NocoBaseFormDocumentOwners } from '../infrastructure/nocobase/NocoBaseFormDocumentOwners';
import { NocoBaseProcessDocumentsRepository } from '../infrastructure/persistence/nocobase/NocoBaseProcessDocumentsRepository';
import { CryptoStorageKeyGenerator } from '../infrastructure/storage/CryptoStorageKeyGenerator';
import { MinioDocumentStorage } from '../infrastructure/storage/minio/MinioDocumentStorage';
import { ProcessDocumentsHooks } from '../interfaces/hooks/ProcessDocumentsHooks';
import { ProcessDocumentsController } from '../interfaces/http/ProcessDocumentsController';
import { TemporaryDocumentDrafts } from '../infrastructure/storage/TemporaryDocumentDrafts';
import { FormDocumentDraftsController } from '../interfaces/http/FormDocumentDraftsController';

export class ProcessDocumentsModule {
  constructor(private readonly plugin: Plugin) {}

  async initialize(): Promise<void> {
    const repository = new NocoBaseProcessDocumentsRepository(this.plugin);
    const fileStorage = this.plugin.app.pm.get<PluginFileStorage>('@log-company/plugin-file-storage');
    const fileManager = this.plugin.app.pm.get(PluginFileManager);
    const storage = new MinioDocumentStorage(fileStorage);
    const logger = new NocoBaseApplicationLogger(this.plugin);
    const identifierGenerator = new NocoBaseIdentifierGenerator(this.plugin);
    const sectionAccess = new DocumentSectionAccess(new NocoBaseDocumentSectionRules(this.plugin));
    const access = new NocoBaseProcessDocumentAccess(this.plugin, sectionAccess);
    const scopeService = new DocumentScopeService(repository, access);
    const folderService = new DocumentFolderService(repository, scopeService, identifierGenerator);
    const deleteProcessDocuments = new DeleteProcessDocumentsForProcess(repository, storage, logger);

    const actions = {
      list: new ListProcessDocuments(repository, scopeService),
      search: new SearchCatalogDocuments(
        (actor, request) => new NocoBaseCatalogSearch(this.plugin.db, scopeService, access, actor, request),
      ),
      setFolderAccess: new SetDocumentFolderAccess(repository, scopeService),
      getFolderConstraints: new GetDocumentFolderConstraints(scopeService, sectionAccess, (scope) =>
        access.documentCompanies(scope),
      ),
      renameEntry: new RenameProcessDocumentEntry(repository, scopeService),
      createFolder: new CreateProcessDocumentFolder(repository, scopeService, folderService),
      uploadFiles: new UploadProcessDocuments(
        repository,
        storage,
        new CryptoStorageKeyGenerator(),
        identifierGenerator,
        scopeService,
        folderService,
        logger,
      ),
      download: new DownloadProcessDocument(scopeService, storage),
      deleteFile: new DeleteProcessDocument(repository, scopeService, storage),
      deleteAttachment: new DeleteRecordAttachment(
        new NocoBaseRecordAttachmentRepository(
          this.plugin.db,
          (record) => {
            const config = [...fileManager.storagesCache].find(([id]) => String(id) === String(record.storageId))?.[1];
            const Storage = config && fileManager.storageTypes.get(config.type);
            if (config && Storage) {
              const store = new Storage(config);
              if (config.type === 'log-company-private-minio') {
                return { backend: 'minio', key: store.getFileKey(record) };
              }
              if (config.type === 'local' && !config.paranoid) {
                return {
                  backend: 'local',
                  remove: async () => {
                    const [removed] = await store.delete([record]);
                    if (removed !== 1) {
                      this.plugin.log.error('Не удалось удалить объект из локального хранилища.');
                      throw new ProcessDocumentsError(
                        'ATTACHMENT_STORAGE_FAILED',
                        'Вложение удалено из карточки, но файл не удалось удалить из локального хранилища.',
                      );
                    }
                  },
                };
              }
            }
            throw new ProcessDocumentsError(
              'ATTACHMENT_STORAGE_UNSUPPORTED',
              'Хранилище не поддерживает удаление из этого блока.',
            );
          },
          fileStorage.deletionQueue.enqueue.bind(fileStorage.deletionQueue),
        ),
      ),
      folderDeleteSummary: new GetProcessDocumentFolderDeleteSummary(repository, scopeService),
      deleteFolder: new DeleteProcessDocumentFolder(repository, scopeService, storage),
      attachDraftDocuments: new AttachDraftDocumentsToProcess(repository, sectionAccess),
    };

    new ProcessDocumentsController(this.plugin, actions, logger, access, sectionAccess).register();
    const applicationKey = createHash('sha256').update(this.plugin.app.name).digest('hex').slice(0, 16);
    const temporaryDrafts = new TemporaryDocumentDrafts(
      path.join(tmpdir(), `log-company-form-documents-${applicationKey}`),
      (error) =>
        logger.warn('Не удалось очистить временные файлы формы.', {
          code: error instanceof Error ? error.name : 'UnknownError',
        }),
    );
    await temporaryDrafts.start();
    this.plugin.app.on('beforeStop', () => temporaryDrafts.stop());
    new FormDocumentDraftsController(
      this.plugin,
      temporaryDrafts,
      new PublishFormDocuments(
        new NocoBaseFormDocumentOwners(this.plugin, fileManager, fileStorage, access),
        repository,
        folderService,
        actions.uploadFiles,
      ),
      scopeService,
    ).register();
    new ProcessDocumentsHooks(
      this.plugin,
      repository,
      storage,
      actions.attachDraftDocuments,
      deleteProcessDocuments,
      new ValidateDocumentFolderPlacement(repository, scopeService),
      new ValidateProcessDocumentPlacement(scopeService),
      folderService,
    ).register();
  }
}
