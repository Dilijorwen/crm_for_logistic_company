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
import logisticsWorkItems from '../collections/logisticsWorkItems';
import { upgradeLogisticsWorkspace } from '../infrastructure/metadata/UpgradeLogisticsWorkspace';

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await upgradeLogisticsWorkspace(this.db);
    const fields = this.db.getRepository('fields');
    for (const collection of [shipments, logisticsWorkItems]) {
      for (const definition of collection.fields || []) {
        if (!definition.name.startsWith('ntm_')) continue;
        const field = await fields.findOne({ filter: { collectionName: collection.name, name: definition.name } });
        if (!field) continue;
        const current = field.get('uiSchema') as Record<string, unknown> | undefined;
        await field.update({ uiSchema: { ...current, title: definition.uiSchema?.title } });
      }
    }
  }
}
