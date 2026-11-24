/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import {
  DOCUMENT_TYPES_BY_CATEGORY,
  isDocumentTypeAllowed,
  type PermitDocumentCategory,
  type PermitDocumentType,
} from '../../../../contracts/permitDocumentTypes';

const typeLabels: Record<PermitDocumentType, string> = {
  declaration_of_conformity: 'ДС',
  certificate_of_conformity: 'СС',
  state_registration_certificate: 'СГР',
};

export function documentTypeOptions(category: PermitDocumentCategory) {
  return DOCUMENT_TYPES_BY_CATEGORY[category].map((value) => ({ value, label: typeLabels[value] }));
}

export function documentTypeForCategory(category: PermitDocumentCategory, value: unknown): unknown {
  if (category === 'voluntary') return DOCUMENT_TYPES_BY_CATEGORY.voluntary[0];
  if (category === 'rented' && !isDocumentTypeAllowed(category, value)) return undefined;
  return value;
}

const manualFields = ['valid_from', 'valid_until', 'product_information', 'manufacturer_name', 'manufacturer_address'];

const generatedFields = [
  'id',
  'name',
  'internal_number',
  'related_document_id',
  'period_from',
  'period_until',
  'status',
  'rental_status',
  'external_id',
  'external_status',
  'sync_status',
  'last_checked_at',
  'last_sync_error',
  'createdAt',
  'updatedAt',
];

export function categoryFieldState(category: PermitDocumentCategory, name: string, isNew: boolean) {
  const voluntary = category === 'voluntary';
  const rented = category === 'rented';
  if (generatedFields.includes(name)) return { visible: false, disabled: true, required: false };
  if (name === 'title' || name === 'category') return { visible: true, disabled: false, required: true };
  if (name === 'company') return { visible: !rented, disabled: false, required: voluntary };
  if (name === 'related_document') return { visible: !voluntary, disabled: voluntary, required: false };
  if (name === 'rental_from' || name === 'rental_until') return { visible: rented, disabled: false, required: rented };
  if (name === 'document_type') return { visible: true, disabled: voluntary, required: true };
  if (name === 'technical_regulations')
    return { visible: voluntary || !isNew, disabled: !voluntary && isNew, required: voluntary };
  if (manualFields.includes(name)) return { visible: voluntary, disabled: !voluntary, required: voluntary };
  if (name === 'documents') return { visible: true, disabled: false, required: voluntary };
  return undefined;
}

export function categoryValue(value: unknown): PermitDocumentCategory {
  return value === 'rented' || value === 'voluntary' ? value : 'ordinary';
}
