/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type {
  DocumentActor,
  DocumentFolderRecord,
  ProcessDocumentsRepository,
} from './ports/ProcessDocumentsRepository';
import { allowsFolderOperation } from '../domain/documents/FolderAccess';
import { ProcessDocumentsError } from '../domain/documents/DocumentErrors';
import { DocumentScopeService } from './DocumentScopeService';

import type { CompanyDocumentTarget } from '../domain/documents/DocumentScope';

export interface ListProcessDocumentsInput extends CompanyDocumentTarget {
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
    let currentFolder: DocumentFolderRecord | null = null;
    if (folderId) {
      try {
        currentFolder = await this.scopeService.requireFolder(folderId, scope);
      } catch (error) {
        if (!(error instanceof ProcessDocumentsError) || error.code !== 'FOLDER_NOT_FOUND') throw error;
        folderId = null;
      }
    }

    await this.scopeService.assertFolderAccess(folderId, scope, 'read', input.actor);
    const can = async (operation: 'write' | 'delete') => {
      try {
        await this.scopeService.resolve({ ...input, operation });
        await this.scopeService.assertFolderAccess(folderId, scope, operation, input.actor);
        return true;
      } catch (error) {
        if (
          error instanceof ProcessDocumentsError &&
          ['SHIPMENT_ACCESS_DENIED', 'DOCUMENT_ACCESS_DENIED', 'DRAFT_ACCESS_DENIED'].includes(error.code)
        )
          return false;
        throw error;
      }
    };
    const [folders, files, breadcrumbs, canWrite, canDelete] = await Promise.all([
      this.repository.listFolders(scope, folderId),
      this.repository.listDocuments(scope, folderId),
      this.scopeService.getBreadcrumbs(folderId, scope),
      can('write'),
      can('delete'),
    ]);
    return {
      currentFolder,
      breadcrumbs,
      folders: folders.filter((folder) => allowsFolderOperation(folder.grants, 'read', input.actor)),
      files,
      permissions: {
        canRead: true,
        canWrite,
        canDelete,
        canManageAccess: input.actor.isRoot && scope.mode !== 'draft',
      },
    };
  }
}
