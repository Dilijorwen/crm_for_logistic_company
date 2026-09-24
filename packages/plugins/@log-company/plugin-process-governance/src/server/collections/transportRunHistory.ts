/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { defineCollection } from '@nocobase/database';
import { historyBaseFields } from './logisticsHistoryFields';

export default defineCollection({
  name: 'transport_run_history',
  title: 'История рейсов',
  hidden: false,
  template: 'general',
  view: false,
  autoGenId: false,
  createdAt: true,
  createdBy: true,
  updatedAt: false,
  updatedBy: false,
  logging: false,
  filterTargetKey: ['id'],
  migrationRules: ['overwrite', 'schema-only'],
  indexes: [{ name: 'transport_run_history_run_created_at_idx', fields: ['transport_run_id', 'createdAt'] }],
  fields: [
    ...historyBaseFields,
    { type: 'bigInt', name: 'transport_run_id', interface: 'integer', isForeignKey: true, allowNull: false },
    {
      type: 'belongsTo',
      name: 'run',
      interface: 'm2o',
      target: 'transport_runs',
      targetKey: 'id',
      foreignKey: 'transport_run_id',
      onDelete: 'CASCADE',
      allowNull: false,
      uiSchema: {
        type: 'object',
        title: 'Рейс',
        'x-component': 'AssociationField',
        'x-component-props': { multiple: false, fieldNames: { value: 'id', label: 'run_number' } },
      },
    },
  ],
});
