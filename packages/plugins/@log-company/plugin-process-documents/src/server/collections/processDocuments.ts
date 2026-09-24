/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'process_documents',
  title: 'Документы поставки',
  template: 'general',
  view: false,
  autoGenId: false,
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
  logging: true,
  filterTargetKey: ['id'],
  migrationRules: ['overwrite', 'schema-only'],
  fields: [
    {
      type: 'snowflakeId',
      name: 'id',
      interface: 'snowflakeId',
      primaryKey: true,
      allowNull: false,
      uiSchema: {
        type: 'number',
        title: 'ID',
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
      uiSchema: { type: 'string', title: 'Название', 'x-component': 'Input', required: true },
    },
    {
      type: 'string',
      name: 'original_filename',
      interface: 'input',
      allowNull: false,
      uiSchema: { type: 'string', title: 'Исходное имя файла', 'x-component': 'Input', required: true },
    },
    {
      type: 'bigInt',
      name: 'shipment_id',
      interface: 'integer',
      isForeignKey: true,
      hidden: true,
      uiSchema: { type: 'number', title: 'Поставка', 'x-component': 'InputNumber', 'x-read-pretty': true },
    },
    {
      type: 'bigInt',
      name: 'process_id',
      interface: 'integer',
      isForeignKey: true,
      hidden: true,
      uiSchema: {
        type: 'number',
        title: 'Старая связь с таможенным процессом',
        'x-component': 'InputNumber',
        'x-read-pretty': true,
      },
    },
    {
      type: 'string',
      name: 'draft_token',
      interface: 'input',
      uiSchema: { type: 'string', title: 'Черновик поставки', 'x-component': 'Input', 'x-read-pretty': true },
    },
    {
      type: 'bigInt',
      name: 'folder_id',
      interface: 'integer',
      isForeignKey: true,
      uiSchema: { type: 'number', title: 'folder_id', 'x-component': 'InputNumber', 'x-read-pretty': true },
    },
    {
      type: 'string',
      name: 'storage_key',
      interface: 'input',
      allowNull: false,
      uiSchema: { type: 'string', title: 'Ключ MinIO', 'x-component': 'Input', required: true },
    },
    {
      type: 'string',
      name: 'mime_type',
      interface: 'input',
      uiSchema: { type: 'string', title: 'MIME-тип', 'x-component': 'Input' },
    },
    {
      type: 'bigInt',
      name: 'file_size',
      interface: 'integer',
      uiSchema: { type: 'number', title: 'Размер файла', 'x-component': 'InputNumber', 'x-read-pretty': true },
    },
  ],
});
