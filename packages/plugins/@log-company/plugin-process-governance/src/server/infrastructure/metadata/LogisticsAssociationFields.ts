/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

function belongsTo(
  name: string,
  target: string,
  foreignKey: string,
  title: string,
  labelField: string,
  required: boolean,
  componentProps: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    name,
    type: 'belongsTo',
    interface: 'm2o',
    target,
    targetKey: 'id',
    foreignKey,
    onDelete: 'RESTRICT',
    allowNull: !required,
    uiSchema: {
      type: 'object',
      title,
      'x-component': 'AssociationField',
      'x-component-props': {
        multiple: false,
        fieldNames: { value: 'id', label: labelField },
        ...componentProps,
      },
      required,
    },
  };
}

function hasManyShipments(collectionName: string, foreignKey: string) {
  return {
    collectionName,
    field: {
      name: 'shipments',
      type: 'hasMany',
      interface: 'o2m',
      target: 'shipments',
      sourceKey: 'id',
      targetKey: 'id',
      foreignKey,
      onDelete: 'RESTRICT',
      uiSchema: {
        type: 'array',
        title: 'Поставки',
        'x-component': 'AssociationField',
        'x-component-props': {
          multiple: true,
          fieldNames: { value: 'id', label: 'display_name' },
        },
      },
    },
  } as const;
}

export const logisticsAssociationFields = [
  {
    collectionName: 'transport_runs',
    field: belongsTo('departure_city', 'departure_cities', 'departure_city_id', 'Город отправления', 'name', false),
  },
  {
    collectionName: 'shipments',
    field: belongsTo('chinese_client', 'chinese_clients', 'chinese_client_id', 'Китайский клиент', 'name', true),
  },
  {
    collectionName: 'shipments',
    field: belongsTo('company', 'our_companies', 'company_id', 'Наша компания', 'name', true),
  },
  {
    collectionName: 'shipments',
    field: belongsTo('contract_record', 'contracts', 'contract_id', 'Контракт', 'name', false, {
      service: {
        params: {
          filter: {
            importers: {
              id: { $eq: '{{$nForm.company.id}}' },
            },
          },
        },
      },
    }),
  },
  {
    collectionName: 'shipments',
    field: belongsTo('customs_warehouse', 'customs_warehouses', 'customs_warehouse_id', 'СВХ', 'name', false),
  },
] as const;

export const logisticsReverseShipmentAssociationFields = [
  hasManyShipments('chinese_clients', 'chinese_client_id'),
  hasManyShipments('our_companies', 'company_id'),
] as const;
