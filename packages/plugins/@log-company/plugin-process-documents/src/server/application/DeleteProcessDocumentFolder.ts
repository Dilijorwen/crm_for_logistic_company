/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { calculateFolderDepth } from '../domain/documents/FolderHierarchy';
import { DocumentScopeService } from './DocumentScopeService';
import type { DocumentStorage } from './ports/DocumentStorage';
import type { DocumentActor, ProcessDocumentsRepository } from './ports/ProcessDocumentsRepository';

export interface DeleteProcessDocumentFolderInput {
  folderId: string;
  draftToken: string | null;
  actor: DocumentActor;
}

export class DeleteProcessDocumentFolder {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly scopeService: DocumentScopeService,
    private readonly storage: DocumentStorage,
  ) {}

  async execute(input: DeleteProcessDocumentFolderInput): Promise<void> {
    const folder = await this.scopeService.requireFolderById(input.folderId);
    const scope = await this.scopeService.resolveForFolder(folder, input.draftToken, 'delete', input.actor);
    await this.repository.withTransaction(async (transaction) => {
      const descendants = await this.scopeService.collectDescendants(folder.id, scope, transaction);
      for (const descendant of descendants) {
        await this.scopeService.assertFolderAccess(descendant.id, scope, 'delete', input.actor, transaction);
      }
      const affectedFolders = [folder, ...descendants];
      const orderedFolders = affectedFolders.sort(
        (left, right) => calculateFolderDepth(right, affectedFolders) - calculateFolderDepth(left, affectedFolders),
      );
      const affectedDocuments = await this.repository.listDocumentsInFolders(
        scope,
        orderedFolders.map((item) => item.id),
        transaction,
      );
      for (const document of affectedDocuments) {
        await this.repository.deleteDocument(document.id, transaction);
      }
      for (const currentFolder of orderedFolders) {
        await this.repository.deleteFolder(currentFolder.id, transaction);
      }
      await this.storage.enqueueDeletion(
        affectedDocuments.map((document) => document.storageKey),
        transaction,
      );
    });
  }
}
