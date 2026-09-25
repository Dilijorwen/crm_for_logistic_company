/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { FieldOptions } from '@nocobase/database';
import { LOGISTICS_STATUS_LABELS, LOGISTICS_STATUS_VALUES } from '../../shared/logistics';

export const idField: FieldOptions = {
  type: 'snowflakeId',
  name: 'id',
  interface: 'snowflakeId',
  primaryKey: true,
  allowNull: false,
  uiSchema: {
    type: 'number',
    title: 'ID',
    'x-component': 'InputNumber',
    'x-component-props': { stringMode: true, separator: '0.00', step: '1' },
    'x-validator': 'integer',
  },
};

export const statusField: FieldOptions = {
  type: 'string',
  name: 'status',
  interface: 'select',
  allowNull: false,
  defaultValue: 'queue',
  validate: { isIn: [[...LOGISTICS_STATUS_VALUES]] },
  uiSchema: {
    type: 'string',
    title: 'Статус',
    'x-component': 'Select',
    enum: LOGISTICS_STATUS_VALUES.map((value) => ({ value, label: LOGISTICS_STATUS_LABELS[value] })),
  },
};
