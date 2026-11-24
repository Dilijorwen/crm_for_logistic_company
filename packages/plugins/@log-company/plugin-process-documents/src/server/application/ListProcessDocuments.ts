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
import {
  companyRequestFolderTitle,
  companyRequestFolderTypes,
  isCompanyRequestFolder,
  type CompanyRequestFolderName,
  type DocumentRight,
} from '../../contracts/processDocuments';

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
    const can = async (operation: 'write' | 'delete' | 'rename') => {
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
    const [folders, files, breadcrumbs, canWrite, canDelete, canRename] = await Promise.all([
      this.repository.listFolders(scope, folderId),
      this.repository.listDocuments(scope, folderId),
      this.scopeService.getBreadcrumbs(folderId, scope),
      can('write'),
      can('delete'),
      can('rename'),
    ]);
    let emptyRequestFolders: CompanyRequestFolderName[] = [];
    const companyFolders = scope.mode === 'company' && scope.companyArea === 'company';
    const isRequestFolder = currentFolder?.parentFolderId === null && isCompanyRequestFolder(currentFolder.title);
    const virtualFolderWrite: Partial<Record<CompanyRequestFolderName, boolean>> = {};
    const sectionRights = new Map<string, Promise<boolean>>();
    const allows = (section: 'requests' | 'corporate', operation: DocumentRight) => {
      const key = `${section}:${operation}`;
      const cached = sectionRights.get(key);
      if (cached) return cached;
      const allowed = this.scopeService.allowsCompanyFolderSection(scope, section, operation, input.actor);
      sectionRights.set(key, allowed);
      return allowed;
    };
    if (companyFolders) {
      const corporate = companyRequestFolderTypes.our_companies;
      if (!folderId && !folders.some(({ title }) => isCompanyRequestFolder(title))) {
        if (await allows('requests', 'read')) {
          emptyRequestFolders = [companyRequestFolderTitle];
          virtualFolderWrite[companyRequestFolderTitle] = canWrite && (await allows('requests', 'write'));
          if (await allows('corporate', 'read')) {
            virtualFolderWrite[corporate] =
              !!virtualFolderWrite[companyRequestFolderTitle] && (await allows('corporate', 'write'));
          }
        }
      } else if (
        isRequestFolder &&
        !folders.some(({ title }) => title === corporate) &&
        (await allows('corporate', 'read'))
      ) {
        emptyRequestFolders = [corporate];
        virtualFolderWrite[corporate] = canWrite && (await allows('corporate', 'write'));
      }
    }
    const visibleFolders = await Promise.all(
      folders.map(async (folder) => {
        const section = !companyFolders
          ? undefined
          : !folderId && isCompanyRequestFolder(folder.title)
            ? 'requests'
            : isRequestFolder && folder.title === companyRequestFolderTypes.our_companies
              ? 'corporate'
              : undefined;
        const allowed = (right: DocumentRight) =>
          allowsFolderOperation(folder.grants, right, input.actor) && (!section || allows(section, right));
        if (!(await allowed('read'))) return [];
        return [
          {
            ...folder,
            canRename: !section && canRename && (await allowed('rename')),
            canDelete: canDelete && (await allowed('delete')),
          },
        ];
      }),
    );
    return {
      currentFolder,
      breadcrumbs,
      folders: visibleFolders.flat(),
      files,
      ...(emptyRequestFolders.length && { emptyRequestFolders }),
      ...(companyFolders && { virtualFolderWrite }),
      permissions: {
        canRead: true,
        canWrite,
        canDelete,
        canRename,
        canManageAccess: input.actor.isRoot && scope.mode !== 'draft',
      },
    };
  }
}
