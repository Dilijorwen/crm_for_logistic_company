/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import {
  assertCanPairPermitDocument,
  PermitDocumentNumberingError,
} from '../domain/permit-document/PermitDocumentNumbering';
import type {
  PermitDocumentNumberingRepository,
  PermitDocumentPairAccess,
  PermitNumberingTransaction,
} from './ports/PermitDocumentNumberingRepository';

export class AssignPermitDocumentNumber {
  constructor(
    private readonly repository: PermitDocumentNumberingRepository,
    private readonly access: PermitDocumentPairAccess,
  ) {}

  async execute(input: {
    documentId: string | null;
    relatedDocumentId: string | null;
    transaction: PermitNumberingTransaction;
    context?: unknown;
  }): Promise<string> {
    await this.repository.lock(input.transaction);
    if (input.relatedDocumentId === null) {
      return this.repository.nextFreeNumber(input.transaction);
    }
    if (input.documentId === input.relatedDocumentId) {
      throw new PermitDocumentNumberingError('SELF_RELATED_DOCUMENT', 'Документ нельзя связать с самим собой.');
    }
    await this.access.assertCanLink(input.relatedDocumentId, input.context, input.transaction);
    const related = await this.repository.findById(input.relatedDocumentId, input.transaction);
    assertCanPairPermitDocument(input.documentId, related);
    return related.internalNumber;
  }
}
