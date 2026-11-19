/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { isDocumentNameSegment } from '../domain/documents/DocumentName';
import { ProcessDocumentsError } from '../domain/documents/DocumentErrors';
import { DocumentFolderService } from './DocumentFolderService';
import { DocumentScopeService } from './DocumentScopeService';
import type { DocumentActor, ProcessDocumentsRepository } from './ports/ProcessDocumentsRepository';

import type { CompanyDocumentTarget } from '../domain/documents/DocumentScope';

export interface CreateProcessDocumentFolderInput extends CompanyDocumentTarget {
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
    if (!isDocumentNameSegment(title)) {
      throw new ProcessDocumentsError('FOLDER_TITLE_REQUIRED', 'Укажите допустимое название папки (до 200 символов).');
    }
    const scope = await this.scopeService.resolve({ ...input, operation: 'write' });
    await this.scopeService.assertFolderAccess(input.parentFolderId, scope, 'write', input.actor);
    return this.repository.withTransaction((transaction) =>
      this.folderService.create(scope, title, input.parentFolderId, input.actor, transaction),
    );
  }
}
