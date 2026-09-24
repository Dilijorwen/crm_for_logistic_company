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
  name: 'shipment_history',
  title: 'История поставок',
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
  indexes: [{ name: 'shipment_history_shipment_created_at_idx', fields: ['shipment_id', 'createdAt'] }],
  fields: [
    ...historyBaseFields,
    { type: 'bigInt', name: 'shipment_id', interface: 'integer', isForeignKey: true, allowNull: false },
    {
      type: 'belongsTo',
      name: 'shipment',
      interface: 'm2o',
      target: 'shipments',
      targetKey: 'id',
      foreignKey: 'shipment_id',
      onDelete: 'CASCADE',
      allowNull: false,
      uiSchema: {
        type: 'object',
        title: 'Поставка',
        'x-component': 'AssociationField',
        'x-component-props': { multiple: false, fieldNames: { value: 'id', label: 'shipment_number' } },
      },
    },
  ],
});
