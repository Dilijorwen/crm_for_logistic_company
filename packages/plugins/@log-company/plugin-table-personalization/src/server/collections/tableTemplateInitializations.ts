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
  name: 'lc_table_template_initializations',
  title: 'Выдача начальных шаблонов',
  hidden: true,
  autoGenId: false,
  timestamps: false,
  fields: [
    { name: 'id', type: 'string', primaryKey: true, allowNull: false },
    { name: 'userId', type: 'bigInt', allowNull: false },
    { name: 'instanceKey', type: 'string', length: 64, allowNull: false },
    { name: 'instanceRootUid', type: 'string', allowNull: false },
    { name: 'tableUid', type: 'string', allowNull: false },
  ],
  indexes: [
    { name: 'lc_template_initializations_owner', fields: ['userId', 'instanceKey'], unique: true },
    { name: 'lc_template_initializations_root', fields: ['instanceRootUid'] },
    { name: 'lc_template_initializations_table', fields: ['tableUid'] },
  ],
});
