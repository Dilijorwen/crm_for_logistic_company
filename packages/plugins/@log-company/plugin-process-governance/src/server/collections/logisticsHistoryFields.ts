/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { FieldOptions } from '@nocobase/database';
import { LOGISTICS_HISTORY_EVENT_LABELS } from '../../shared/logistics';
import { idField } from './logisticsCollectionFields';

export const historyBaseFields: FieldOptions[] = [
  idField,
  {
    type: 'string',
    name: 'event_type',
    interface: 'select',
    allowNull: false,
    uiSchema: {
      type: 'string',
      title: 'Событие',
      'x-component': 'Select',
      enum: Object.entries(LOGISTICS_HISTORY_EVENT_LABELS).map(([value, label]) => ({ value, label })),
    },
  },
  {
    type: 'string',
    name: 'field_name',
    interface: 'input',
    uiSchema: { type: 'string', title: 'Поле', 'x-component': 'Input' },
  },
  {
    type: 'string',
    name: 'field_label',
    interface: 'input',
    uiSchema: { type: 'string', title: 'Название поля', 'x-component': 'Input' },
  },
  {
    type: 'text',
    name: 'old_value',
    interface: 'textarea',
    uiSchema: { type: 'string', title: 'Было', 'x-component': 'Input.TextArea' },
  },
  {
    type: 'text',
    name: 'new_value',
    interface: 'textarea',
    uiSchema: { type: 'string', title: 'Стало', 'x-component': 'Input.TextArea' },
  },
];
