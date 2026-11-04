/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export {
  clearProcessDocumentsDraftToken,
  getProcessDocumentsDraftToken,
  PROCESS_DOCUMENTS_DRAFT_FIELD,
  ensureProcessDocumentsDraftToken,
} from './model/draftToken';
export { ProcessDocumentsApi } from './api/ProcessDocumentsApi';
export type {
  DocumentFolderDto,
  ProcessDocumentDto,
  DocumentsListResponse,
  DocumentRequestScope,
} from '../../../contracts/processDocuments';
export { useDocumentsList } from './model/useDocumentsList';
export { getDocumentErrorText } from './lib/errorText';
