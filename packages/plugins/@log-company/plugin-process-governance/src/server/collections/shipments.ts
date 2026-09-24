/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { defineCollection, type FieldOptions } from '@nocobase/database';
import { idField } from './logisticsCollectionFields';

function stringField(name: string, title: string): FieldOptions {
  return {
    type: 'string',
    name,
    interface: 'input',
    trim: true,
    uiSchema: { type: 'string', title, 'x-component': 'Input' },
  };
}

function textField(name: string, title: string): FieldOptions {
  return {
    type: 'text',
    name,
    interface: 'textarea',
    uiSchema: { type: 'string', title, 'x-component': 'Input.TextArea' },
  };
}

function numberField(name: string, title: string, step: string): FieldOptions {
  return {
    type: 'double',
    name,
    interface: 'number',
    validate: { min: 0 },
    uiSchema: {
      type: 'number',
      title,
      'x-component': 'InputNumber',
      'x-component-props': { stringMode: true, step, decimalSeparator: ',' },
    },
  };
}

function booleanField(name: string, title: string): FieldOptions {
  return {
    type: 'boolean',
    name,
    interface: 'checkbox',
    uiSchema: { type: 'boolean', title, 'x-component': 'Checkbox' },
  };
}

function dateField(name: string, title: string): FieldOptions {
  return {
    type: 'dateOnly',
    name,
    interface: 'date',
    uiSchema: {
      type: 'string',
      title,
      'x-component': 'DatePicker',
      'x-component-props': { dateOnly: true, picker: 'date', dateFormat: 'DD.MM.YYYY' },
    },
  };
}

export default defineCollection({
  name: 'shipments',
  title: 'Поставки',
  hidden: false,
  template: 'general',
  view: false,
  autoGenId: false,
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
  logging: true,
  titleField: 'display_name',
  filterTargetKey: ['id'],
  migrationRules: ['overwrite', 'schema-only'],
  indexes: [
    { name: 'shipments_shipment_number_unique', unique: true, fields: ['shipment_number'] },
    { name: 'shipments_chinese_client_id_idx', fields: ['chinese_client_id'] },
    { name: 'shipments_company_id_idx', fields: ['company_id'] },
    { name: 'shipments_route_delivery_number_idx', fields: ['route_delivery_number'] },
    { name: 'shipments_declaration_number_idx', fields: ['declaration_number'] },
  ],
  fields: [
    idField,
    {
      type: 'integer',
      name: 'shipment_number',
      interface: 'integer',
      allowNull: false,
      uiSchema: {
        type: 'number',
        title: 'Номер поставки',
        'x-component': 'InputNumber',
        'x-read-pretty': true,
      },
    },
    {
      type: 'string',
      name: 'display_name',
      interface: 'input',
      allowNull: true,
      uiSchema: {
        type: 'string',
        title: 'Название поставки',
        'x-component': 'Input',
        'x-read-pretty': true,
      },
    },
    { type: 'bigInt', name: 'chinese_client_id', interface: 'integer', isForeignKey: true, allowNull: false },
    { type: 'bigInt', name: 'company_id', interface: 'integer', isForeignKey: true, allowNull: false },
    stringField('route_delivery_number', 'Номер доставки'),
    stringField('invoice_number', 'Номер инвойса'),
    numberField('invoice_value', 'Стоимость по инвойсу', '0.01'),
    { type: 'bigInt', name: 'contract_id', interface: 'integer', isForeignKey: true, allowNull: true },
    {
      type: 'string',
      name: 'customs_scheme',
      interface: 'select',
      uiSchema: {
        type: 'string',
        title: 'Таможенная схема',
        'x-component': 'Select',
        enum: [
          { value: 'operator', label: 'Оператор' },
          { value: 'els', label: 'ЕЛС' },
        ],
      },
    },
    { type: 'bigInt', name: 'customs_warehouse_id', interface: 'integer', isForeignKey: true, allowNull: true },
    dateField('customs_warehouse_storage_date', 'Дата размещения на СВХ'),
    stringField('declaration_number', 'Номер декларации'),
    stringField('application_number', 'Номер заявления'),
    booleanField('documents_in_badis', 'Документы в БАДИС'),
    numberField('customs_payments_amount', 'Сумма таможенных платежей', '0.01'),
    numberField('eco_fee', 'Экологический сбор', '0.01'),
    numberField('ktc_amount', 'Сумма КТС', '0.01'),
    textField('ntm_certificate_goods', 'Товары для сертификата НТМ'),
    textField('ntm_skk_goods', 'Товары для СКК НТМ'),
    textField('ntm_kfk_goods', 'Товары для КФК НТМ'),
    textField('ntm_honest_sign_goods', 'Товары для «Честного знака» НТМ'),
    booleanField('ntm_export_declaration_required', 'Требуется экспортная декларация НТМ'),
    numberField('ntm_honest_sign_sum', 'Сумма «Честного знака» НТМ', '0.01'),
    numberField('goods_count', 'Количество товаров', '1'),
    booleanField('entered_in_1c', 'Внесено в 1С'),
    booleanField('sent_to_client', 'Отправлено клиенту'),
    dateField('declaration_release_date', 'Дата выпуска декларации'),
    dateField('application_release_date', 'Дата выпуска заявления'),
    dateField('additional_check_response_deadline', 'Срок ответа по дополнительной проверке'),
    booleanField('actual_control', 'Фактический контроль'),
    booleanField('anosov_distributed', 'Распределено Аносовым'),
    textField('manager_comment', 'Комментарий менеджера'),
    {
      type: 'belongsToMany',
      name: 'runs',
      interface: 'm2m',
      target: 'transport_runs',
      through: 'transport_run_shipments',
      sourceKey: 'id',
      targetKey: 'id',
      foreignKey: 'shipment_id',
      otherKey: 'transport_run_id',
      onDelete: 'CASCADE',
      uiSchema: {
        type: 'array',
        title: 'Рейсы',
        'x-component': 'AssociationField',
        'x-component-props': { multiple: true, fieldNames: { value: 'id', label: 'run_number' } },
      },
    },
    {
      type: 'hasMany',
      name: 'comments',
      interface: 'o2m',
      target: 'shipment_comments',
      sourceKey: 'id',
      foreignKey: 'shipment_id',
      targetKey: 'id',
      onDelete: 'CASCADE',
      uiSchema: {
        type: 'array',
        title: 'Комментарии',
        'x-component': 'AssociationField',
        'x-component-props': { multiple: true },
      },
    },
    {
      type: 'hasMany',
      name: 'history',
      interface: 'o2m',
      target: 'shipment_history',
      sourceKey: 'id',
      foreignKey: 'shipment_id',
      targetKey: 'id',
      onDelete: 'CASCADE',
      uiSchema: {
        type: 'array',
        title: 'История',
        'x-component': 'AssociationField',
        'x-component-props': { multiple: true },
      },
    },
  ],
});
