/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { companyRequestFolderTypes, isCompanyRequestFolder } from '../../contracts/processDocuments';
import { ProcessDocumentsError } from '../domain/documents/DocumentErrors';
import { isDocumentNameSegment } from '../domain/documents/DocumentName';
import { DocumentScopeService } from './DocumentScopeService';
import type { DocumentActor, ProcessDocumentsRepository } from './ports/ProcessDocumentsRepository';

export class RenameProcessDocumentEntry {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly scopes: DocumentScopeService,
  ) {}

  async execute(input: {
    kind: 'folder' | 'file';
    id: string;
    title: string;
    draftToken: string | null;
    actor: DocumentActor;
  }): Promise<void> {
    const title = input.title.trim();
    if (!isDocumentNameSegment(title)) {
      throw new ProcessDocumentsError('INVALID_DOCUMENT_NAME', 'Укажите допустимое имя файла или папки.');
    }

    await this.repository.withTransaction(async (transaction) => {
      let existingTitle: string;
      let nextTitle = title;
      let siblingTitles: string[];
      if (input.kind === 'folder') {
        const folder = await this.scopes.requireFolderById(input.id, transaction);
        const scope = await this.scopes.resolveForFolder(folder, input.draftToken, 'rename', input.actor);
        if (scope.mode === 'company' && scope.companyArea === 'company') {
          const parent = await this.scopes.requireFolder(folder.parentFolderId, scope, transaction);
          const isReserved = (name: string) =>
            !parent
              ? isCompanyRequestFolder(name)
              : isCompanyRequestFolder(parent.title) &&
                Object.values(companyRequestFolderTypes).some((type) => type === name);
          if (isReserved(folder.title) || isReserved(title)) {
            throw new ProcessDocumentsError('INVALID_DOCUMENT_NAME', 'Эта папка используется CRM.');
          }
        }
        existingTitle = folder.title;
        siblingTitles = await this.repository.listFolderTitles(scope, folder.parentFolderId, transaction);
      } else {
        const file = await this.scopes.requireDocument(input.id, transaction);
        const scope = await this.scopes.resolveForDocument(file, input.draftToken, 'rename', input.actor);
        existingTitle = file.title;
        const dot = file.originalFilename.lastIndexOf('.');
        if (dot > 0) nextTitle += file.originalFilename.slice(dot);
        if (!isDocumentNameSegment(nextTitle)) {
          throw new ProcessDocumentsError('INVALID_DOCUMENT_NAME', 'Слишком длинное имя файла.');
        }
        siblingTitles = await this.repository.listDocumentTitles(scope, file.folderId, transaction);
      }

      if (existingTitle === nextTitle) return;
      if (siblingTitles.includes(nextTitle)) {
        throw new ProcessDocumentsError('DOCUMENT_NAME_CONFLICT', 'Такое имя уже используется в этой папке.');
      }
      await this.repository.renameEntry(input.kind, input.id, nextTitle, transaction);
    });
  }
}
