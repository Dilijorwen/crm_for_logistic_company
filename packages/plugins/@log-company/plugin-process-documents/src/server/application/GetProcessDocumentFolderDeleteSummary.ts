/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DocumentScopeService } from './DocumentScopeService';
import type { DocumentActor, ProcessDocumentsRepository } from './ports/ProcessDocumentsRepository';

export interface GetProcessDocumentFolderDeleteSummaryInput {
  folderId: string;
  draftToken: string | null;
  actor: DocumentActor;
}

export class GetProcessDocumentFolderDeleteSummary {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly scopeService: DocumentScopeService,
  ) {}

  async execute(input: GetProcessDocumentFolderDeleteSummaryInput) {
    const folder = await this.scopeService.requireFolderById(input.folderId);
    const scope = await this.scopeService.resolveForFolder(folder, input.draftToken, 'delete', input.actor);
    const descendants = await this.scopeService.collectDescendants(folder.id, scope);
    for (const descendant of descendants) {
      await this.scopeService.assertFolderAccess(descendant.id, scope, 'delete', input.actor);
    }
    const documents = await this.repository.listDocumentsInFolders(scope, [
      folder.id,
      ...descendants.map((item) => item.id),
    ]);
    return {
      title: folder.title,
      folders: descendants.length,
      files: documents.length,
    };
  }
}
