/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export const PROCESS_DOCUMENTS_DRAFT_FIELD = '_shipmentDocumentsDraftToken';

export type DocumentIdentifier = string | number;
export type DocumentRequestScope =
  | { shipmentId: DocumentIdentifier; draftToken?: undefined }
  | { draftToken: string; shipmentId?: undefined };

export interface DocumentFolderDto {
  id: DocumentIdentifier;
  title: string;
  createdAt?: string | null;
  author?: string;
}

export interface ProcessDocumentDto extends DocumentFolderDto {
  original_filename?: string;
  mime_type?: string;
  file_size?: number;
}

export interface DocumentsListResponse {
  breadcrumbs: Array<{ id: DocumentIdentifier; title: string }>;
  folders: DocumentFolderDto[];
  files: ProcessDocumentDto[];
  permissions: { canWrite: boolean; canDelete: boolean };
}

export interface FolderDeleteSummary {
  folders: number;
  files: number;
}
