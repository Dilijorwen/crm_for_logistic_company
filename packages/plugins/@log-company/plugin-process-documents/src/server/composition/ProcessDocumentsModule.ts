/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import { AttachDraftDocumentsToProcess } from '../application/AttachDraftDocumentsToProcess';
import { CreateProcessDocumentFolder } from '../application/CreateProcessDocumentFolder';
import { DeleteProcessDocument } from '../application/DeleteProcessDocument';
import { DeleteProcessDocumentFolder } from '../application/DeleteProcessDocumentFolder';
import { DeleteProcessDocumentsForProcess } from '../application/DeleteProcessDocumentsForProcess';
import { DocumentFolderService } from '../application/DocumentFolderService';
import { DocumentScopeService } from '../application/DocumentScopeService';
import { DownloadProcessDocument } from '../application/DownloadProcessDocument';
import { GetProcessDocumentFolderDeleteSummary } from '../application/GetProcessDocumentFolderDeleteSummary';
import { ListProcessDocuments } from '../application/ListProcessDocuments';
import { UploadProcessDocuments } from '../application/UploadProcessDocuments';
import { ValidateDocumentFolderPlacement } from '../application/ValidateDocumentFolderPlacement';
import { ValidateProcessDocumentPlacement } from '../application/ValidateProcessDocumentPlacement';
import { NocoBaseApplicationLogger } from '../infrastructure/nocobase/NocoBaseApplicationLogger';
import { NocoBaseIdentifierGenerator } from '../infrastructure/nocobase/NocoBaseIdentifierGenerator';
import { NocoBaseProcessDocumentAccess } from '../infrastructure/nocobase/NocoBaseProcessDocumentAccess';
import { NocoBaseProcessDocumentsRepository } from '../infrastructure/persistence/nocobase/NocoBaseProcessDocumentsRepository';
import { CryptoStorageKeyGenerator } from '../infrastructure/storage/CryptoStorageKeyGenerator';
import { MinioDocumentStorage, readMinioConfig } from '../infrastructure/storage/minio/MinioDocumentStorage';
import { ProcessDocumentsHooks } from '../interfaces/hooks/ProcessDocumentsHooks';
import { ProcessDocumentsController } from '../interfaces/http/ProcessDocumentsController';

export class ProcessDocumentsModule {
  constructor(private readonly plugin: Plugin) {}

  async initialize(): Promise<void> {
    const repository = new NocoBaseProcessDocumentsRepository(this.plugin);
    const storage = new MinioDocumentStorage(readMinioConfig(process.env));
    const logger = new NocoBaseApplicationLogger(this.plugin);
    const identifierGenerator = new NocoBaseIdentifierGenerator(this.plugin);
    const access = new NocoBaseProcessDocumentAccess(this.plugin);
    const scopeService = new DocumentScopeService(repository, access);
    const folderService = new DocumentFolderService(repository, scopeService, identifierGenerator);
    const deleteProcessDocuments = new DeleteProcessDocumentsForProcess(repository, storage, logger);

    const actions = {
      list: new ListProcessDocuments(repository, scopeService),
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
      deleteFile: new DeleteProcessDocument(repository, scopeService, storage, logger),
      folderDeleteSummary: new GetProcessDocumentFolderDeleteSummary(repository, scopeService),
      deleteFolder: new DeleteProcessDocumentFolder(repository, scopeService, storage, logger),
      attachDraftDocuments: new AttachDraftDocumentsToProcess(repository),
    };

    await storage.ensureReady();
    new ProcessDocumentsController(this.plugin, actions, logger).register();
    new ProcessDocumentsHooks(
      this.plugin,
      repository,
      storage,
      actions.attachDraftDocuments,
      deleteProcessDocuments,
      new ValidateDocumentFolderPlacement(repository, scopeService),
      new ValidateProcessDocumentPlacement(scopeService),
      logger,
    ).register();
  }
}
