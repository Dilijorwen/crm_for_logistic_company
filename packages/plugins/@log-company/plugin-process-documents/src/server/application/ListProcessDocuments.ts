/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { DocumentActor, ProcessDocumentsRepository } from './ports/ProcessDocumentsRepository';
import { DocumentScopeService } from './DocumentScopeService';

export interface ListProcessDocumentsInput {
  shipmentId: string | null;
  draftToken: string | null;
  folderId: string | null;
  actor: DocumentActor;
}

export class ListProcessDocuments {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly scopeService: DocumentScopeService,
  ) {}

  async execute(input: ListProcessDocumentsInput) {
    const scope = await this.scopeService.resolve({ ...input, operation: 'read' });
    let folderId = input.folderId;
    if (folderId) {
      try {
        await this.scopeService.requireFolder(folderId, scope);
      } catch {
        folderId = null;
      }
    }

    const [folders, files, breadcrumbs] = await Promise.all([
      this.repository.listFolders(scope, folderId),
      this.repository.listDocuments(scope, folderId),
      this.scopeService.getBreadcrumbs(folderId, scope),
    ]);
    return {
      breadcrumbs,
      folders,
      files,
      permissions: { canRead: true, canWrite: true, canDelete: true },
    };
  }
}
