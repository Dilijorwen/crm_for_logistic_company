/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import shipments from '../collections/shipments';

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const definition = shipments.fields?.find((field) => field.name === 'declarant_comment');
    if (!definition) throw new Error('Не найдено определение поля «Комментарий декларанта».');
    const { type, interface: interfaceName, name, ...options } = definition;
    await this.db.getRepository('fields').firstOrCreate({
      filterKeys: ['collectionName', 'name'],
      values: {
        key: 'lcshipmentdeclarantcomment',
        collectionName: shipments.name,
        name,
        type,
        interface: interfaceName,
        options,
      },
      hooks: false,
    });
  }
}
