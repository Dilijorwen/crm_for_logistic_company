/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Transaction } from '@nocobase/database';
import { Migration } from '@nocobase/server';
import type { WorkspaceFlowTree } from '../infrastructure/metadata/LogisticsWorkspaceNativeModels';

const grids = [
  'lcwscreaterununifiedshipmentdetailsgrid',
  'lcwsrunformunifiedshipmentdetailsgrid',
  'lcwscreateshipgridsection0',
  'lcwscreateshipgridsection1',
  'lcwscreateshipgridsection2',
  'lcwspagegeneralgrid',
  'lcwspagecustomsgrid',
  'lcwspagentmgrid',
];

type Options = { transaction: Transaction; includeAsyncNode: true };
interface Models {
  findModelById(uid: string, options: Options): Promise<WorkspaceFlowTree | null>;
  upsertModel(model: Pick<WorkspaceFlowTree, 'uid' | 'use'>, options: Options): Promise<unknown>;
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    if (!this.db.getCollection('flowModels')) return;
    const models = this.db.getRepository('flowModels') as unknown as Models;
    await this.db.sequelize.transaction(async (transaction) => {
      const options: Options = { transaction, includeAsyncNode: true };
      for (const uid of grids) {
        const grid = await models.findModelById(uid, options);
        if (grid?.use === 'FormGridModel') {
          await models.upsertModel({ uid, use: 'LogisticsWorkspaceShipmentFieldsGridModel' }, options);
        }
      }
    });
  }
}
