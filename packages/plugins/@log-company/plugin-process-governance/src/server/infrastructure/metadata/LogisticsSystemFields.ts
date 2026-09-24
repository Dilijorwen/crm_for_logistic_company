/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

const timestampField = (name: 'createdAt' | 'updatedAt', title: string) => ({
  name,
  type: 'date',
  field: name,
  interface: name,
  uiSchema: {
    type: 'datetime',
    title,
    'x-component': 'DatePicker',
    'x-component-props': {
      dateFormat: 'DD.MM.YYYY',
      showTime: true,
    },
    'x-read-pretty': true,
  },
});

const mutableCollectionTimestamps = (collectionName: string) => [
  { collectionName, field: timestampField('createdAt', 'Дата создания') },
  { collectionName, field: timestampField('updatedAt', 'Дата обновления') },
];

const appendOnlyCollectionTimestamp = (collectionName: string) => [
  { collectionName, field: timestampField('createdAt', 'Дата создания') },
];

export const logisticsSystemFields = [
  ...mutableCollectionTimestamps('vehicles'),
  ...mutableCollectionTimestamps('transport_runs'),
  ...mutableCollectionTimestamps('shipments'),
  ...appendOnlyCollectionTimestamp('transport_run_history'),
  ...appendOnlyCollectionTimestamp('shipment_history'),
  ...mutableCollectionTimestamps('shipment_comments'),
] as const;
