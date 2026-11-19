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
  | { draftToken: string; shipmentId?: undefined }
  | {
      companyId: DocumentIdentifier;
      companyArea?: 'company';
      runId?: undefined;
      shipmentId?: undefined;
      draftToken?: undefined;
    }
  | { runId: DocumentIdentifier; companyId?: DocumentIdentifier; shipmentId?: undefined; draftToken?: undefined };

export type FolderGrant = { kind: 'role' | 'user'; subject: string; level: 'read' | 'write' | 'delete' };

export const documentSections = ['company', 'corporate', 'ved', 'permits'] as const;
export const documentRights = ['read', 'write', 'delete'] as const;
export type DocumentSection = (typeof documentSections)[number];
export type DocumentRight = (typeof documentRights)[number];
export type DocumentRights = Partial<Record<DocumentRight, boolean>>;
export interface DocumentAccessRule {
  kind: FolderGrant['kind'];
  subject: string;
  rights: DocumentRights;
}
export type FolderAccess = FolderGrant[] | { rules: DocumentAccessRule[]; defaultAllow?: false };

export interface SectionAccessResponse {
  rules: DocumentAccessRule[];
  inherited: DocumentAccessRule[];
}

export interface SectionPermissions {
  sections: Record<DocumentSection, boolean>;
  canManageAccess: boolean;
}

export interface DocumentFolderDto {
  id: DocumentIdentifier;
  title: string;
  createdAt?: string | null;
  author?: string;
  grants?: FolderAccess | null;
}

export interface ProcessDocumentDto extends DocumentFolderDto {
  original_filename?: string;
  mime_type?: string;
  file_size?: number;
}

export interface DocumentsListResponse {
  currentFolder?: DocumentFolderDto | null;
  breadcrumbs: Array<{ id: DocumentIdentifier; title: string }>;
  folders: DocumentFolderDto[];
  files: ProcessDocumentDto[];
  permissions: { canWrite: boolean; canDelete: boolean; canManageAccess?: boolean };
}

export interface FolderDeleteSummary {
  folders: number;
  files: number;
}
