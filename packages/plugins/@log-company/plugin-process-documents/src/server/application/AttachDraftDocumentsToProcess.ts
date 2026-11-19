/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ProcessDocumentsError } from '../domain/documents/DocumentErrors';
import type { DocumentSectionAccess } from './DocumentSectionAccess';
import type { ProcessDocumentsRepository, TransactionContext } from './ports/ProcessDocumentsRepository';

export interface AttachDraftDocumentsToProcessInput {
  draftToken: string | null;
  shipmentId: string | null;
  actorId: string | null;
  isRoot: boolean;
  companyId?: string | null;
  roles?: readonly string[];
  transaction?: TransactionContext;
}

export class AttachDraftDocumentsToProcess {
  constructor(
    private readonly repository: ProcessDocumentsRepository,
    private readonly sectionAccess?: DocumentSectionAccess,
  ) {}

  async execute(input: AttachDraftDocumentsToProcessInput): Promise<void> {
    if (!input.draftToken || !input.shipmentId) {
      return;
    }
    if (
      !input.isRoot &&
      (!input.actorId || (await this.repository.draftHasRecordsOwnedByOther(input.draftToken, input.actorId)))
    ) {
      throw new ProcessDocumentsError('DRAFT_ACCESS_DENIED', 'Нет прав для переноса черновых документов в поставку.');
    }
    if (this.sectionAccess && !input.isRoot) {
      const actor = { userId: input.actorId, isRoot: false, roles: input.roles, authorizationContext: null };
      if (!(await this.sectionAccess.allows('ved', input.companyId ?? null, 'write', actor))) {
        const draft = { mode: 'draft' as const, draftToken: input.draftToken };
        const [folders, files] = await Promise.all([
          this.repository.listFolders(draft, null),
          this.repository.listDocuments(draft, null),
        ]);
        if (!folders.length && !files.length) return;
        throw new ProcessDocumentsError('DOCUMENT_ACCESS_DENIED', 'У вас нет права загружать документы в разделе ВЭД.');
      }
    }
    await this.repository.attachDraftToShipment(input.draftToken, input.shipmentId, input.transaction);
  }
}
