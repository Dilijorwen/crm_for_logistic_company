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
  name: 'lc_table_filter_templates',
  title: 'Личные шаблоны таблиц',
  hidden: true,
  autoGenId: false,
  timestamps: true,
  fields: [
    { name: 'id', type: 'string', primaryKey: true, allowNull: false },
    { name: 'userId', type: 'bigInt', allowNull: false },
    { name: 'instanceKey', type: 'string', length: 64, allowNull: false },
    { name: 'instanceRootUid', type: 'string', allowNull: false },
    { name: 'tableUid', type: 'string', allowNull: false },
    { name: 'name', type: 'string', length: 100, allowNull: false },
    { name: 'filter', type: 'json', allowNull: false },
    { name: 'columnSettings', type: 'json', allowNull: false },
    { name: 'revision', type: 'integer', allowNull: false },
  ],
  indexes: [
    { name: 'lc_filter_templates_name', fields: ['instanceKey', 'userId', 'name'], unique: true },
    { name: 'lc_filter_templates_user', fields: ['userId'] },
    { name: 'lc_filter_templates_table', fields: ['tableUid'] },
    { name: 'lc_filter_templates_root', fields: ['instanceRootUid'] },
  ],
});
