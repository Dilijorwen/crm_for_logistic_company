/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { FieldOptions } from '@nocobase/database';

const fieldProps = 'usePermitDocumentFieldProps';
const dateField = (name: string, title: string, disabled = false): FieldOptions => ({
  name,
  type: 'dateOnly',
  interface: 'date',
  allowNull: true,
  uiSchema: {
    type: 'string',
    title,
    'x-component': 'DatePicker',
    'x-use-component-props': fieldProps,
    'x-component-props': { dateOnly: true, dateFormat: 'DD.MM.YYYY', disabled },
  },
});

export const permitDocumentCategoryFields: FieldOptions[] = [
  {
    name: 'category',
    type: 'string',
    interface: 'select',
    allowNull: false,
    defaultValue: 'ordinary',
    validate: { isIn: [['ordinary', 'rented', 'voluntary']] },
    uiSchema: {
      type: 'string',
      title: 'Категория',
      'x-component': 'Select',
      default: 'ordinary',
      required: true,
      'x-use-component-props': fieldProps,
      enum: [
        { value: 'ordinary', label: 'Обычный' },
        { value: 'rented', label: 'Арендованный' },
        { value: 'voluntary', label: 'Добровольный' },
      ],
    },
  },
  dateField('rental_from', 'Аренда с'),
  dateField('rental_until', 'Аренда до'),
  dateField('period_from', 'Срок с', true),
  dateField('period_until', 'Срок до', true),
  ...[
    { name: 'manufacturer_name', title: 'Изготовитель' },
    { name: 'manufacturer_address', title: 'Адрес изготовителя' },
  ].map(
    ({ name, title }): FieldOptions => ({
      name,
      type: 'text',
      interface: 'textarea',
      allowNull: true,
      uiSchema: {
        type: 'string',
        title,
        'x-component': 'Input.TextArea',
        'x-use-component-props': fieldProps,
        'x-component-props': { disabled: true },
      },
    }),
  ),
  {
    name: 'rental_status',
    type: 'string',
    interface: 'select',
    allowNull: true,
    uiSchema: {
      type: 'string',
      title: 'Состояние аренды',
      'x-component': 'Select',
      'x-component-props': { disabled: true },
      enum: [
        { value: 'active', label: 'Аренда действует' },
        { value: 'expired', label: 'Аренда истекла' },
      ],
    },
  },
];
