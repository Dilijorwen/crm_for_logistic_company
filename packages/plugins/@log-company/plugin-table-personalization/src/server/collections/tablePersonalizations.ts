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
  name: 'lc_table_personalizations',
  title: 'Персональные колонки таблиц',
  hidden: true,
  timestamps: true,
  fields: [
    { name: 'userId', type: 'bigInt', allowNull: false },
    { name: 'instanceKey', type: 'string', length: 64, allowNull: false },
    { name: 'instanceRootUid', type: 'string', allowNull: false },
    { name: 'tableUid', type: 'string', allowNull: false },
    { name: 'settings', type: 'json', allowNull: false },
  ],
  indexes: [
    { name: 'lc_table_personalizations_owner', fields: ['userId', 'instanceKey'], unique: true },
    { name: 'lc_table_personalizations_table', fields: ['tableUid'] },
    { name: 'lc_table_personalizations_root', fields: ['instanceRootUid'] },
  ],
});
