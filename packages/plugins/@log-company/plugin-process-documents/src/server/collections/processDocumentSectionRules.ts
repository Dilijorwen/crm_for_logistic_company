/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { defineCollection } from '@nocobase/database';

export const documentSectionRulesCollection = 'process_document_section_rules';

export default defineCollection({
  name: documentSectionRulesCollection,
  title: 'Права разделов документов',
  hidden: true,
  autoGenId: false,
  createdAt: false,
  updatedAt: false,
  filterTargetKey: ['id'],
  fields: [
    { type: 'string', name: 'id', primaryKey: true, allowNull: false },
    { type: 'jsonb', name: 'rules', allowNull: false, defaultValue: [] },
  ],
});
