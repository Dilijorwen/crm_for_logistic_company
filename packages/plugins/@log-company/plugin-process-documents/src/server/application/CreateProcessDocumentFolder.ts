/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ProcessDocumentsError } from '../domain/documents/DocumentErrors';
import { DocumentFolderService } from './DocumentFolderService';
import { DocumentScopeService } from './DocumentScopeService';
import type { DocumentActor, ProcessDocumentsRepository } from './ports/ProcessDocumentsRepository';

export interface CreateProcessDocumentFolderInput {
  shipmentId: string | null;
  draftToken: string | null;
  parentFolderId: string | null;
  title: string;
  actor: DocumentActor;
}

export class CreateProcessDocumentFolder {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly scopeService: DocumentScopeService,
    private readonly folderService: DocumentFolderService,
  ) {}

  async execute(input: CreateProcessDocumentFolderInput) {
    const title = input.title.trim();
    if (!title) {
      throw new ProcessDocumentsError('FOLDER_TITLE_REQUIRED', 'Укажите название папки.');
    }
    const scope = await this.scopeService.resolve({ ...input, operation: 'write' });
    return this.repository.withTransaction((transaction) =>
      this.folderService.create(scope, title, input.parentFolderId, input.actor, transaction),
    );
  }
}
