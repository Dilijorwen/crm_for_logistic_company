/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { defineCollection } from '@nocobase/database';

const NAMESPACE = '@log-company/plugin-permit-documents';
const translate = (key: string) => `{{t("${key}", { ns: "${NAMESPACE}" })}}`;

export default defineCollection({
  name: 'technical_regulations',
  title: translate('collection.technicalRegulations'),
  template: 'general',
  autoGenId: false,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  logging: true,
  titleField: 'doc_num',
  filterTargetKey: ['id'],
  migrationRules: ['overwrite', 'schema-only'],
  indexes: [
    { name: 'technical_regulations_fsa_id_unique', unique: true, fields: ['fsa_id'] },
    { name: 'technical_regulations_doc_num_unique', unique: true, fields: ['doc_num'] },
  ],
  fields: [
    { type: 'snowflakeId', name: 'id', interface: 'snowflakeId', primaryKey: true, allowNull: false },
    {
      type: 'integer',
      name: 'fsa_id',
      interface: 'integer',
      uiSchema: { type: 'number', title: translate('field.fsaId'), 'x-component': 'InputNumber' },
    },
    {
      type: 'string',
      name: 'doc_num',
      interface: 'input',
      allowNull: false,
      trim: true,
      uiSchema: { type: 'string', title: translate('field.docNum'), 'x-component': 'Input', required: true },
    },
    {
      type: 'string',
      name: 'name',
      interface: 'input',
      uiSchema: { type: 'string', title: translate('field.technicalRegulationName'), 'x-component': 'Input' },
    },
    {
      type: 'belongsToMany',
      name: 'permit_documents',
      interface: 'm2m',
      target: 'permit_documents',
      targetKey: 'id',
      sourceKey: 'id',
      through: 'document_technical_regulations',
      foreignKey: 'technical_regulation_id',
      otherKey: 'document_id',
      onDelete: 'CASCADE',
      uiSchema: {
        type: 'array',
        title: translate('collection.permitDocuments'),
        'x-component': 'AssociationField',
        'x-component-props': { multiple: true, disabled: true, fieldNames: { label: 'title', value: 'id' } },
      },
    },
  ],
});
