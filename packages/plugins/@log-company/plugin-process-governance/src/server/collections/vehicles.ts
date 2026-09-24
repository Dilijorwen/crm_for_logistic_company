/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { defineCollection } from '@nocobase/database';
import { idField } from './logisticsCollectionFields';

export default defineCollection({
  name: 'vehicles',
  title: 'Транспортные средства',
  hidden: true,
  template: 'general',
  view: false,
  autoGenId: false,
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
  logging: true,
  titleField: 'registration_number',
  filterTargetKey: ['id'],
  migrationRules: ['overwrite', 'schema-only'],
  indexes: [{ name: 'vehicles_registration_number_unique', unique: true, fields: ['registration_number'] }],
  fields: [
    idField,
    {
      type: 'string',
      name: 'registration_number',
      interface: 'input',
      allowNull: false,
      trim: true,
      validation: {
        type: 'string',
        rules: [
          { key: 'vehicle_registration_number_required', name: 'required' },
          { key: 'vehicle_registration_number_max', name: 'max', args: { limit: 32 } },
        ],
      },
      uiSchema: {
        type: 'string',
        title: 'Номер машины',
        'x-component': 'Input',
        required: true,
      },
    },
    {
      type: 'hasMany',
      name: 'runs',
      interface: 'o2m',
      target: 'transport_runs',
      sourceKey: 'id',
      foreignKey: 'vehicle_id',
      targetKey: 'id',
      onDelete: 'RESTRICT',
      uiSchema: {
        type: 'array',
        title: 'Рейсы',
        'x-component': 'AssociationField',
        'x-component-props': { multiple: true },
      },
    },
  ],
});
