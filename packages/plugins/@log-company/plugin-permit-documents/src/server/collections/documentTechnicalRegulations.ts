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
  name: 'document_technical_regulations',
  title: 'Document technical regulations',
  template: 'general',
  autoGenId: false,
  createdAt: false,
  updatedAt: false,
  createdBy: false,
  updatedBy: false,
  logging: true,
  filterTargetKey: ['id'],
  migrationRules: ['overwrite', 'schema-only'],
  indexes: [{ name: 'document_technical_regulations_regulation_idx', fields: ['technical_regulation_id'] }],
  fields: [
    { type: 'snowflakeId', name: 'id', interface: 'snowflakeId', primaryKey: true, allowNull: false },
    { type: 'bigInt', name: 'document_id', interface: 'integer', isForeignKey: true, allowNull: false },
    { type: 'bigInt', name: 'technical_regulation_id', interface: 'integer', isForeignKey: true, allowNull: false },
  ],
});
