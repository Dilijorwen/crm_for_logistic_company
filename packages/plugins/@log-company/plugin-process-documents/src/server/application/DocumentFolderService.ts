/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createUniqueDocumentName } from '../domain/documents/DocumentName';
import { companyRequestFolderTypes, isCompanyRequestFolder } from '../../contracts/processDocuments';
import { ProcessDocumentsError } from '../domain/documents/DocumentErrors';
import type { DocumentScope } from '../domain/documents/DocumentScope';
import type { IdentifierGenerator } from './ports/DocumentStorage';
import type {
  DocumentActor,
  DocumentFolderRecord,
  ProcessDocumentsRepository,
  TransactionContext,
} from './ports/ProcessDocumentsRepository';
import { DocumentScopeService } from './DocumentScopeService';

export class DocumentFolderService {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly scopeService: DocumentScopeService,
    private readonly identifierGenerator: IdentifierGenerator,
  ) {}

  async create(
    scope: DocumentScope,
    title: string,
    parentFolderId: string | null,
    actor: DocumentActor,
    transaction?: TransactionContext,
  ): Promise<DocumentFolderRecord> {
    const parent = await this.scopeService.requireFolder(parentFolderId, scope, transaction);
    if (transaction && scope.mode === 'company' && scope.companyArea === 'company') {
      const requestRoot = !parent && isCompanyRequestFolder(title);
      const corporateFolder =
        parent?.parentFolderId === null &&
        isCompanyRequestFolder(parent.title) &&
        title === companyRequestFolderTypes.our_companies;
      if (requestRoot || corporateFolder) {
        await this.scopeService.assertCompanyFolderSection(scope, 'requests', 'write', actor);
        if (corporateFolder) await this.scopeService.assertCompanyFolderSection(scope, 'corporate', 'write', actor);
        await this.repository.lockCompanyFolders(scope.companyId, transaction);
        const matches = (await this.repository.listFolders(scope, parentFolderId, transaction)).filter((folder) =>
          requestRoot ? isCompanyRequestFolder(folder.title) : folder.title === title,
        );
        if (matches.length > 1) {
          throw new ProcessDocumentsError('DOCUMENT_NAME_CONFLICT', 'Найдено несколько папок с таким именем.');
        }
        if (matches[0]) {
          await this.scopeService.assertFolderAccess(matches[0].id, scope, 'write', actor, transaction);
          return matches[0];
        }
      }
    }
    const existingTitles = await this.repository.listFolderTitles(scope, parentFolderId, transaction);
    const uniqueTitle = createUniqueDocumentName(title, existingTitles, false);
    return this.repository.createFolder(
      {
        id: this.identifierGenerator.generate(),
        title: uniqueTitle,
        scope,
        parentFolderId,
        actorId: actor.userId,
      },
      transaction,
    );
  }

  async createPath(
    scope: DocumentScope,
    parentFolderId: string | null,
    folderNames: string[],
    actor: DocumentActor,
    cache: Map<string, string>,
    transaction?: TransactionContext,
  ): Promise<{ folderId: string | null; created: DocumentFolderRecord[] }> {
    let currentParentId = parentFolderId;
    const created: DocumentFolderRecord[] = [];
    for (const folderName of folderNames) {
      const cacheKey = `${currentParentId || 'root'}\n${folderName}`;
      const cachedFolderId = cache.get(cacheKey);
      if (cachedFolderId) {
        currentParentId = cachedFolderId;
        continue;
      }

      const folder = await this.create(scope, folderName, currentParentId, actor, transaction);
      created.push(folder);
      currentParentId = folder.id;
      cache.set(cacheKey, currentParentId);
    }
    return { folderId: currentParentId, created };
  }
}
