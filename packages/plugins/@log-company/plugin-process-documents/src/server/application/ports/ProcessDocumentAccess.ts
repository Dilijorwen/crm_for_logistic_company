/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { CompanyDocumentScope } from '../../domain/documents/DocumentScope';
import type { DocumentRight } from '../../../contracts/processDocuments';
import type { DocumentActor, TransactionContext } from './ProcessDocumentsRepository';

export type ProcessDocumentOperation = DocumentRight;

export interface ProcessDocumentAccess {
  allowsCompanyFolderSection?(
    section: 'requests' | 'corporate',
    companyId: string,
    operation: ProcessDocumentOperation,
    actor: DocumentActor,
  ): Promise<boolean>;
  assertDraftAccess?(operation: ProcessDocumentOperation, actor: DocumentActor): Promise<void>;
  assertRunAccess?(
    runId: string,
    operation: ProcessDocumentOperation,
    actor: DocumentActor,
    companyId: string | null,
    transaction?: TransactionContext,
  ): Promise<void>;
  assertCompanyAccess?(
    scope: CompanyDocumentScope,
    operation: ProcessDocumentOperation,
    actor: DocumentActor,
    transaction?: TransactionContext,
  ): Promise<void>;
  assertAccess(
    shipmentId: string,
    operation: ProcessDocumentOperation,
    actor: DocumentActor,
    transaction?: TransactionContext,
  ): Promise<void>;
}
