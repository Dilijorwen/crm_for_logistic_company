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

interface Models {
  findModelById(uid: string, options: { transaction: Transaction }): Promise<WorkspaceFlowTree | null>;
  upsertModel(model: Partial<WorkspaceFlowTree>, options: { transaction: Transaction }): Promise<unknown>;
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await this.db.sequelize.transaction(async (transaction) => {
      const models = this.db.getRepository('flowModels') as unknown as Models;
      for (const uid of ['lcwsrunformgriddocumentsfiles', 'lcwscreaterungriddocumentsfiles']) {
        const block = await models.findModelById(uid, { transaction });
        if (block?.use === 'CompanyFilesBlockModel') {
          await models.upsertModel({ uid, use: 'ProcessDocumentsBlockModel' }, { transaction });
        }
      }
    });
  }
}
