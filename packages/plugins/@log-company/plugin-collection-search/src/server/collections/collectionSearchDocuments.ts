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
  name: 'lc_collection_search_documents',
  title: 'Collection search documents',
  hidden: true,
  autoGenId: false,
  timestamps: true,
  fields: [
    {
      type: 'string',
      name: 'dataSourceKey',
      primaryKey: true,
      allowNull: false,
    },
    {
      type: 'string',
      name: 'collectionName',
      primaryKey: true,
      allowNull: false,
    },
    {
      type: 'string',
      name: 'recordKey',
      length: 1024,
      primaryKey: true,
      allowNull: false,
    },
    {
      type: 'jsonb',
      name: 'keyValues',
      allowNull: false,
      defaultValue: {},
    },
    {
      type: 'jsonb',
      name: 'fieldValues',
      allowNull: false,
      defaultValue: {},
    },
    {
      type: 'text',
      name: 'searchText',
      allowNull: false,
      defaultValue: '',
    },
  ],
  indexes: [
    {
      name: 'lc_collection_search_documents_collection',
      fields: ['dataSourceKey', 'collectionName'],
    },
  ],
});
