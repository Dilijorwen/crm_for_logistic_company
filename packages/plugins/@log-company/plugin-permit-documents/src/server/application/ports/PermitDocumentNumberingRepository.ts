/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export type PermitNumberingTransaction = object;

export interface NumberedPermitDocument {
  id: string;
  internalNumber: string;
  relatedDocumentId: string | null;
}

export interface PermitDocumentNumberingRepository {
  lock(transaction: PermitNumberingTransaction): Promise<void>;
  findById(id: string, transaction: PermitNumberingTransaction): Promise<NumberedPermitDocument | null>;
  nextFreeNumber(transaction: PermitNumberingTransaction): Promise<string>;
  completePair(documentId: string, relatedDocumentId: string, transaction: PermitNumberingTransaction): Promise<void>;
}

export interface PermitDocumentPairAccess {
  assertCanLink(documentId: string, context: unknown, transaction: PermitNumberingTransaction): Promise<void>;
}
