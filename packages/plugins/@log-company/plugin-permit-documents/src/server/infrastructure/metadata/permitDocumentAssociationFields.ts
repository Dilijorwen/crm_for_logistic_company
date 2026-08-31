/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

const NAMESPACE = '@log-company/plugin-permit-documents';
const title = `{{t("field.company", { ns: "${NAMESPACE}" })}}`;
const collectionTitle = `{{t("collection.permitDocuments", { ns: "${NAMESPACE}" })}}`;

export const permitDocumentCompanyField = {
  name: 'company',
  type: 'belongsTo',
  interface: 'm2o',
  target: 'our_companies',
  targetKey: 'id',
  foreignKey: 'company_id',
  onDelete: 'RESTRICT',
  uiSchema: {
    type: 'object',
    title,
    'x-component': 'AssociationField',
    'x-component-props': {
      multiple: false,
      fieldNames: { label: 'name', value: 'id' },
    },
    required: true,
  },
} as const;

export const companyPermitDocumentsField = {
  name: 'permit_documents',
  type: 'hasMany',
  interface: 'o2m',
  target: 'permit_documents',
  sourceKey: 'id',
  targetKey: 'id',
  foreignKey: 'company_id',
  onDelete: 'RESTRICT',
  uiSchema: {
    type: 'array',
    title: collectionTitle,
    'x-component': 'AssociationField',
    'x-component-props': { multiple: true },
  },
} as const;
