/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export type ProcessDocumentsErrorCode =
  | 'SHIPMENT_REQUIRED'
  | 'SHIPMENT_NOT_FOUND'
  | 'FOLDER_NOT_FOUND'
  | 'DOCUMENT_NOT_FOUND'
  | 'INVALID_DRAFT_TOKEN'
  | 'SHIPMENT_ACCESS_DENIED'
  | 'DRAFT_ACCESS_DENIED'
  | 'CROSS_SCOPE_FOLDER'
  | 'FOLDER_TITLE_REQUIRED'
  | 'FILES_REQUIRED'
  | 'FOLDER_SELF_PARENT'
  | 'FOLDER_CYCLE'
  | 'STORAGE_UPLOAD_FAILED';

export class ProcessDocumentsError extends Error {
  constructor(
    readonly code: ProcessDocumentsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ProcessDocumentsError';
  }
}
