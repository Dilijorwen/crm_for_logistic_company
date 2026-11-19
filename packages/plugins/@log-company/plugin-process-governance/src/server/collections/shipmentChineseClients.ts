/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'shipment_chinese_clients',
  title: 'Китайские клиенты поставок',
  hidden: true,
  autoGenId: false,
  timestamps: false,
  fields: [
    { name: 'id', type: 'bigInt', primaryKey: true, autoIncrement: true },
    { name: 'shipment_id', type: 'bigInt', allowNull: false, isForeignKey: true },
    { name: 'chinese_client_id', type: 'bigInt', allowNull: false, isForeignKey: true },
  ],
  indexes: [
    { name: 'shipment_chinese_clients_unique', fields: ['shipment_id', 'chinese_client_id'], unique: true },
    { name: 'shipment_chinese_clients_client_idx', fields: ['chinese_client_id'] },
  ],
});
