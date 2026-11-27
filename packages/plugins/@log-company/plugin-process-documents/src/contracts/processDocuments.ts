/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export const PROCESS_DOCUMENTS_DRAFT_FIELD = '_shipmentDocumentsDraftToken';
export const MAX_DOCUMENT_UPLOAD_ENTRIES = 1000;
export const MAX_DOCUMENT_UPLOAD_PATH_SEGMENTS = 200;
export const FORM_DOCUMENT_DRAFT_HEADER = 'X-Log-Company-Form-Documents';
export const FORM_DOCUMENT_DRAFT_PENDING = 'pending';
export const PERMIT_DOCUMENT_FOLDERS_META = 'logCompanyDocumentFolders';

export const companyRequestFolderTitle = 'По запросу';
export const companyRequestFolderTypes = {
  our_companies: 'Учредительные документы',
  contracts: 'Контракт',
} as const;
export type CompanyRequestFolderName =
  | typeof companyRequestFolderTitle
  | (typeof companyRequestFolderTypes)[keyof typeof companyRequestFolderTypes];

export function isCompanyRequestFolder(title: string): boolean {
  const normalized = title.trim().replace(/\s+/g, ' ').toLowerCase();
  return normalized === 'по запросу' || normalized === 'по запросам';
}

export const documentFormResources = [
  'shipments',
  'transport_runs',
  'permit_documents',
  'our_companies',
  'contracts',
] as const;
export type DocumentFormResource = (typeof documentFormResources)[number];
export function isDocumentFormResource(resource: unknown): resource is DocumentFormResource {
  return documentFormResources.some((name) => name === resource);
}

export function documentRecordId(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return;
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return;
  const id = String(value);
  if (/^[1-9][0-9]{0,18}$/.test(id) && (id.length < 19 || id <= '9223372036854775807')) return id;
}

export interface FormDocumentSaveTarget {
  resource: DocumentFormResource;
  recordId: string | null;
}

export interface FormDocumentBatch {
  token: string;
  files: { id: string; name: string; size: number }[];
  emptyFolders?: string[];
}

export function supportsFormFolderUploads(resource: DocumentFormResource): boolean {
  return resource === 'shipments' || resource === 'transport_runs';
}

export type DocumentIdentifier = string | number;
export type CompanyDocumentArea = 'company' | 'permits' | `contract:${string}`;
export function contractAreaId(area: unknown): string | undefined {
  return typeof area === 'string' && area.startsWith('contract:') ? documentRecordId(area.slice(9)) : undefined;
}
export function isCompanyDocumentArea(value: unknown): value is CompanyDocumentArea {
  return value === 'company' || value === 'permits' || contractAreaId(value) !== undefined;
}

export type DocumentRequestScope =
  | { shipmentId: DocumentIdentifier; draftToken?: undefined }
  | { draftToken: string; shipmentId?: undefined }
  | {
      companyId: DocumentIdentifier;
      companyArea?: CompanyDocumentArea;
      runId?: undefined;
      shipmentId?: undefined;
      draftToken?: undefined;
    }
  | { runId: DocumentIdentifier; companyId?: DocumentIdentifier; shipmentId?: undefined; draftToken?: undefined };

export type FolderGrant = { kind: 'role' | 'user'; subject: string; level: 'read' | 'write' | 'delete' };

export const documentSections = ['company', 'corporate', 'ved', 'permits', 'contracts', 'requests'] as const;
export const documentRights = ['read', 'write', 'rename', 'delete'] as const;
export type DocumentSection = (typeof documentSections)[number];
export type DocumentRight = (typeof documentRights)[number];
export type DocumentRights = Partial<Record<DocumentRight, boolean>>;

export function defaultDocumentSectionRights(section: DocumentSection): DocumentRights {
  return section === 'ved' ? { delete: false } : {};
}

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

export type FolderAccessConstraint =
  | { type: 'folder'; title: string; grants: FolderAccess }
  | {
      type: 'section';
      title: string;
      section: DocumentSection;
      policies: SectionAccessResponse[];
      readPolicies?: SectionAccessResponse[];
    };

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
  canRename?: boolean;
  canDelete?: boolean;
  canWrite?: boolean;
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
  emptyRequestFolders?: CompanyRequestFolderName[];
  virtualFolderWrite?: Partial<Record<CompanyRequestFolderName, boolean>>;
  permissions: { canWrite: boolean; canDelete: boolean; canRename?: boolean; canManageAccess?: boolean };
}

export interface FolderDeleteSummary {
  folders: number;
  files: number;
}

export const shipmentDepartmentFolders = ['Менеджеры', 'Декларанты', 'Бухгалтерия', 'Юристы', 'Карго'] as const;
