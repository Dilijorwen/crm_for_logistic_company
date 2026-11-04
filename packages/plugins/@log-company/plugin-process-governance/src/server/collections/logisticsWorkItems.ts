/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { defineCollection, type FieldOptions } from '@nocobase/database';
import { LOGISTICS_STATUS_LABELS, LOGISTICS_STATUS_VALUES } from '../../shared/logistics';
import { TRANSPORT_TYPES, TRANSPORT_TYPE_LABELS } from '../../shared/transport';
import shipments from './shipments';

function field(type: FieldOptions['type'], name: string, title: string, interfaceName = 'input'): FieldOptions {
  const source = shipments.fields?.find((item) => item.name === name);
  if (source) return shipmentField(name, title);
  const isNumber = type === 'integer' || type === 'double';
  return {
    type,
    name,
    interface: interfaceName,
    uiSchema: {
      type: type === 'boolean' ? 'boolean' : isNumber ? 'number' : 'string',
      title,
      'x-component': type === 'boolean' ? 'Checkbox' : isNumber ? 'InputNumber' : 'Input',
    },
  };
}

function numberField(name: string, title: string): FieldOptions {
  return shipmentField(name, title);
}

/** The SQL view preserves values; its field semantics must match the source too. */
function shipmentField(name: string, title: string): FieldOptions {
  const source = shipments.fields?.find((item) => item.name === name);
  if (!source) throw new Error(`Не найдено исходное поле поставки: ${name}`);
  return { name, type: source.type, interface: source.interface, uiSchema: { ...source.uiSchema, title } };
}

function dateField(name: string, title: string): FieldOptions {
  return {
    ...field('dateOnly', name, title, 'date'),
    uiSchema: {
      type: 'string',
      title,
      'x-component': 'DatePicker',
      'x-component-props': { dateOnly: true, picker: 'date', dateFormat: 'DD.MM.YYYY' },
    },
  };
}

/**
 * Read-only projection: one row is a concrete shipment in a concrete run.
 * A run without shipments deliberately stays visible as an unlinked row.
 */
export default defineCollection({
  name: 'logistics_work_items',
  title: 'Общий рабочий список',
  hidden: false,
  template: 'general',
  view: true,
  writableView: false,
  schema: 'public',
  autoGenId: false,
  timestamps: false,
  logging: false,
  titleField: 'shipment_number',
  filterTargetKey: ['id'],
  migrationRules: ['overwrite', 'schema-only'],
  fields: [
    {
      type: 'string',
      name: 'id',
      interface: 'input',
      primaryKey: true,
      allowNull: false,
      uiSchema: { type: 'string', title: 'ID', 'x-component': 'Input' },
    },
    field('integer', 'run_number', 'Номер рейса', 'integer'),
    field('string', 'registration_number', 'Номер машины'),
    field('string', 'departure_city_name', 'Город отправления'),
    field('text', 'manager_names', 'Менеджеры', 'textarea'),
    field('text', 'declarant_names', 'Декларанты', 'textarea'),
    field('integer', 'shipment_number', 'Номер поставки', 'integer'),
    {
      type: 'string',
      name: 'transport_type',
      interface: 'select',
      uiSchema: {
        type: 'string',
        title: 'Тип перевозки',
        'x-component': 'Select',
        enum: TRANSPORT_TYPES.map((value) => ({ value, label: TRANSPORT_TYPE_LABELS[value] })),
      },
    },
    field('string', 'chinese_client_name', 'Китайский клиент'),
    field('string', 'company_name', 'Наша компания'),
    field('string', 'contract_name', 'Контракт'),
    {
      type: 'string',
      name: 'status',
      interface: 'select',
      allowNull: true,
      uiSchema: {
        type: 'string',
        title: 'Статус',
        'x-component': 'Select',
        enum: LOGISTICS_STATUS_VALUES.map((value) => ({ value, label: LOGISTICS_STATUS_LABELS[value] })),
      },
    },
    field('string', 'invoice_number', 'Номер инвойса'),
    numberField('invoice_value', 'Стоимость по инвойсу'),
    shipmentField('customs_scheme', 'Таможенная схема'),
    field('string', 'customs_warehouse_name', 'СВХ'),
    dateField('customs_warehouse_storage_date', 'Дата размещения на СВХ'),
    field('string', 'declaration_number', 'Номер декларации'),
    field('string', 'application_number', 'Номер заявления'),
    field('boolean', 'documents_in_badis', 'Документы в БАДИС', 'checkbox'),
    numberField('customs_payments_amount', 'Сумма таможенных платежей'),
    numberField('eco_fee', 'Экологический сбор'),
    numberField('ktc_amount', 'Сумма КТС'),
    field('text', 'ntm_certificate_goods', 'Товары для сертификата', 'textarea'),
    field('text', 'ntm_skk_goods', 'Товары для СКК', 'textarea'),
    field('text', 'ntm_kfk_goods', 'Товары для КФК', 'textarea'),
    field('text', 'ntm_honest_sign_goods', 'Товары для «Честного знака»', 'textarea'),
    field('boolean', 'ntm_export_declaration_required', 'Требуется экспортная декларация', 'checkbox'),
    numberField('ntm_honest_sign_sum', 'Сумма «Честного знака»'),
    numberField('goods_count', 'Количество товаров'),
    field('boolean', 'entered_in_1c', 'Внесено в 1С', 'checkbox'),
    field('boolean', 'sent_to_client', 'Отправлено клиенту', 'checkbox'),
    dateField('additional_check_response_deadline', 'Срок ответа по дополнительной проверке'),
    field('boolean', 'actual_control', 'Фактический контроль', 'checkbox'),
    field('boolean', 'anosov_distributed', 'Распределено Аносовым', 'checkbox'),
    field('text', 'manager_comment', 'Комментарий менеджера', 'textarea'),
    { type: 'bigInt', name: 'run_id', hidden: true, isForeignKey: true },
    { type: 'bigInt', name: 'shipment_id', hidden: true, isForeignKey: true },
    {
      type: 'belongsTo',
      name: 'run',
      target: 'transport_runs',
      foreignKey: 'run_id',
      hidden: true,
      constraints: false,
    },
    {
      type: 'belongsTo',
      name: 'shipment',
      target: 'shipments',
      foreignKey: 'shipment_id',
      hidden: true,
      constraints: false,
    },
  ],
});
