/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { defineCollection, type FieldOptions } from '@nocobase/database';
import {
  PERMIT_DOCUMENT_STATUSES,
  PERMIT_DOCUMENT_SYNC_STATUSES,
  PERMIT_DOCUMENT_TYPES,
} from '../domain/permit-document/PermitDocumentPolicy';

const NAMESPACE = '@log-company/plugin-permit-documents';
const translate = (key: string) => `{{t("${key}", { ns: "${NAMESPACE}" })}}`;
const requiredRule = (key: string): { key: string; name: 'required' } => ({ key, name: 'required' });
const readOnlyProps = { disabled: true } as const;

export const permitDocumentFields: FieldOptions[] = [
  {
    type: 'snowflakeId',
    name: 'id',
    interface: 'snowflakeId',
    primaryKey: true,
    allowNull: false,
    uiSchema: {
      type: 'number',
      title: '{{t("ID")}}',
      'x-component': 'InputNumber',
      'x-component-props': { stringMode: true, separator: '0.00', step: '1' },
      'x-validator': 'integer',
    },
  },
  {
    type: 'string',
    name: 'title',
    interface: 'input',
    allowNull: false,
    trim: true,
    validation: {
      type: 'string',
      rules: [
        requiredRule('permit_document_title_required'),
        { key: 'permit_document_title_max', name: 'max', args: { limit: 255 } },
      ],
    },
    uiSchema: { type: 'string', title: translate('field.title'), 'x-component': 'Input', required: true },
  },
  {
    type: 'string',
    name: 'document_type',
    interface: 'select',
    allowNull: false,
    validate: { isIn: [[...PERMIT_DOCUMENT_TYPES]] },
    validation: { type: 'string', rules: [requiredRule('permit_document_type_required')] },
    uiSchema: {
      type: 'string',
      title: translate('field.documentType'),
      'x-component': 'Select',
      required: true,
      enum: [
        { value: 'declaration_of_conformity', label: translate('documentType.declarationOfConformity') },
        { value: 'certificate_of_conformity', label: translate('documentType.certificateOfConformity') },
        { value: 'state_registration_certificate', label: translate('documentType.stateRegistrationCertificate') },
      ],
    },
  },
  {
    type: 'dateOnly',
    name: 'valid_from',
    interface: 'date',
    uiSchema: {
      type: 'string',
      title: translate('field.validFrom'),
      'x-component': 'DatePicker',
      'x-component-props': { dateOnly: true, picker: 'date', dateFormat: 'DD.MM.YYYY', ...readOnlyProps },
    },
  },
  {
    type: 'dateOnly',
    name: 'valid_until',
    interface: 'date',
    uiSchema: {
      type: 'string',
      title: translate('field.validUntil'),
      'x-component': 'DatePicker',
      'x-component-props': { dateOnly: true, picker: 'date', dateFormat: 'DD.MM.YYYY', ...readOnlyProps },
    },
  },
  {
    type: 'string',
    name: 'status',
    interface: 'select',
    validate: { isIn: [[...PERMIT_DOCUMENT_STATUSES]] },
    uiSchema: {
      type: 'string',
      title: translate('field.status'),
      'x-component': 'Select',
      'x-component-props': readOnlyProps,
      enum: [
        { value: 'valid', label: translate('status.valid') },
        { value: 'suspended', label: translate('status.suspended') },
        { value: 'terminated', label: translate('status.terminated') },
      ],
    },
  },
  {
    type: 'text',
    name: 'product_information',
    interface: 'textarea',
    uiSchema: {
      type: 'string',
      title: translate('field.productInformation'),
      'x-component': 'Input.TextArea',
      'x-component-props': readOnlyProps,
    },
  },
  { type: 'bigInt', name: 'company_id', interface: 'integer', isForeignKey: true, allowNull: false },
  {
    type: 'string',
    name: 'external_id',
    interface: 'input',
    uiSchema: {
      type: 'string',
      title: translate('field.externalId'),
      'x-component': 'Input',
      'x-component-props': readOnlyProps,
    },
  },
  {
    type: 'string',
    name: 'external_status',
    interface: 'input',
    uiSchema: {
      type: 'string',
      title: translate('field.externalStatus'),
      'x-component': 'Input',
      'x-component-props': readOnlyProps,
    },
  },
  {
    type: 'string',
    name: 'sync_status',
    interface: 'select',
    allowNull: false,
    defaultValue: 'PENDING',
    validate: { isIn: [[...PERMIT_DOCUMENT_SYNC_STATUSES]] },
    uiSchema: {
      type: 'string',
      title: translate('field.syncStatus'),
      'x-component': 'Select',
      'x-component-props': readOnlyProps,
      enum: PERMIT_DOCUMENT_SYNC_STATUSES.map((value) => ({ value, label: translate(`syncStatus.${value}`) })),
    },
  },
  {
    type: 'date',
    name: 'last_checked_at',
    interface: 'datetime',
    uiSchema: {
      type: 'string',
      title: translate('field.lastCheckedAt'),
      'x-component': 'DatePicker',
      'x-component-props': { showTime: true, ...readOnlyProps },
    },
  },
  {
    type: 'text',
    name: 'last_sync_error',
    interface: 'textarea',
    uiSchema: {
      type: 'string',
      title: translate('field.lastSyncError'),
      'x-component': 'Input.TextArea',
      'x-component-props': readOnlyProps,
    },
  },
  {
    type: 'belongsToMany',
    name: 'technical_regulations',
    interface: 'm2m',
    target: 'technical_regulations',
    targetKey: 'id',
    sourceKey: 'id',
    through: 'document_technical_regulations',
    foreignKey: 'document_id',
    otherKey: 'technical_regulation_id',
    onDelete: 'CASCADE',
    uiSchema: {
      type: 'array',
      title: translate('field.technicalRegulations'),
      'x-component': 'AssociationField',
      'x-component-props': { multiple: true, disabled: true, fieldNames: { label: 'doc_num', value: 'id' } },
    },
  },
  {
    type: 'belongsToMany',
    name: 'documents',
    interface: 'attachment',
    target: 'attachments',
    targetKey: 'id',
    sourceKey: 'id',
    through: 'permit_document_attachments',
    foreignKey: 'permit_document_id',
    otherKey: 'attachment_id',
    onDelete: 'CASCADE',
    storage: 'local',
    uiSchema: {
      type: 'array',
      title: translate('field.documents'),
      'x-component': 'Upload.Attachment',
      'x-use-component-props': 'useAttachmentFieldProps',
      'x-component-props': { multiple: true },
    },
  },
];

export default defineCollection({
  name: 'permit_documents',
  title: translate('collection.permitDocuments'),
  template: 'general',
  view: false,
  autoGenId: false,
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
  logging: true,
  titleField: 'title',
  filterTargetKey: ['id'],
  migrationRules: ['overwrite', 'schema-only'],
  indexes: [
    { name: 'permit_documents_company_status_valid_until_idx', fields: ['company_id', 'status', 'valid_until'] },
    { name: 'permit_documents_document_identity_unique', unique: true, fields: ['document_type', 'title'] },
    { name: 'permit_documents_external_identity_unique', unique: true, fields: ['document_type', 'external_id'] },
    { name: 'permit_documents_daily_sync_idx', fields: ['status', 'sync_status', 'last_checked_at'] },
  ],
  fields: permitDocumentFields,
});
