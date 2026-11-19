/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DocumentScopeService } from './DocumentScopeService';
import type { DocumentStorage } from './ports/DocumentStorage';
import type { DocumentActor, ProcessDocumentsRepository } from './ports/ProcessDocumentsRepository';

export interface DeleteProcessDocumentInput {
  documentId: string;
  draftToken: string | null;
  actor: DocumentActor;
}

export class DeleteProcessDocument {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly scopeService: DocumentScopeService,
    private readonly storage: DocumentStorage,
  ) {}

  async execute(input: DeleteProcessDocumentInput): Promise<void> {
    const document = await this.scopeService.requireDocument(input.documentId);
    await this.scopeService.resolveForDocument(document, input.draftToken, 'delete', input.actor);
    await this.repository.withTransaction(async (transaction) => {
      await this.repository.deleteDocument(document.id, transaction);
      await this.storage.enqueueDeletion([document.storageKey], transaction);
    });
  }
}
