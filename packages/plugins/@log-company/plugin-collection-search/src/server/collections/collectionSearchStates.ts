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
  name: 'lc_collection_search_states',
  title: 'Collection search states',
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
      name: 'schemaSignature',
      length: 64,
      allowNull: false,
    },
    {
      type: 'string',
      name: 'status',
      length: 32,
      allowNull: false,
    },
    {
      type: 'text',
      name: 'errorMessage',
    },
    {
      type: 'date',
      name: 'indexedAt',
    },
  ],
});
