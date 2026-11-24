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

interface Models {
  findModelById(
    uid: string,
    options: { transaction: Transaction; includeAsyncNode: true },
  ): Promise<{ use?: string } | null>;
  upsertModel(model: { uid: string; use: string }, options: { transaction: Transaction }): Promise<unknown>;
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    if (!this.db.getCollection('flowModels')) return;
    const models = this.db.getRepository('flowModels') as unknown as Models;
    await this.db.sequelize.transaction(async (transaction) => {
      const uid = 'lcwsrunhistorytable';
      const block = await models.findModelById(uid, { transaction, includeAsyncNode: true });
      if (block?.use === 'TableBlockModel') {
        await models.upsertModel({ uid, use: 'LogisticsWorkspaceHistoryBlockModel' }, { transaction });
      }
    });
  }
}
