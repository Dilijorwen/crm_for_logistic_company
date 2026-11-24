/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export const PERMIT_DOCUMENT_TYPES = [
  'declaration_of_conformity',
  'certificate_of_conformity',
  'state_registration_certificate',
] as const;

export type PermitDocumentType = (typeof PERMIT_DOCUMENT_TYPES)[number];
export type PermitDocumentCategory = 'ordinary' | 'rented' | 'voluntary';

export const DOCUMENT_TYPES_BY_CATEGORY: Record<PermitDocumentCategory, readonly PermitDocumentType[]> = {
  ordinary: PERMIT_DOCUMENT_TYPES,
  rented: ['declaration_of_conformity', 'certificate_of_conformity'],
  voluntary: ['certificate_of_conformity'],
};

export function isDocumentTypeAllowed(category: PermitDocumentCategory, value: unknown): value is PermitDocumentType {
  return DOCUMENT_TYPES_BY_CATEGORY[category].some((type) => type === value);
}
