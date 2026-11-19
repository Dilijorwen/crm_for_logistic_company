/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { FolderAccess } from '../../contracts/processDocuments';
import { ProcessDocumentsError } from '../domain/documents/DocumentErrors';
import type { DocumentScopeService } from './DocumentScopeService';
import type { DocumentActor, ProcessDocumentsRepository } from './ports/ProcessDocumentsRepository';

export class SetDocumentFolderAccess {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly scopes: DocumentScopeService,
  ) {}

  async execute(folderId: string, grants: FolderAccess | null, actor: DocumentActor): Promise<void> {
    if (!actor.isRoot || !this.repository.setFolderGrants) {
      throw new ProcessDocumentsError('DOCUMENT_ACCESS_DENIED', 'Настройка доступа доступна администратору.');
    }
    const folder = await this.scopes.requireFolderById(folderId);
    await this.scopes.resolveForFolder(folder, null, 'write', actor);
    await this.repository.setFolderGrants(folderId, grants);
  }
}
