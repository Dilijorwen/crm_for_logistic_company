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
import {
  workspaceDiscussionTab,
  type WorkspaceFlowTree,
} from '../infrastructure/metadata/LogisticsWorkspaceNativeModels';

interface Models {
  findModelById(
    uid: string,
    options: { transaction: Transaction; includeAsyncNode: true },
  ): Promise<WorkspaceFlowTree | null>;
  upsertModel(model: Partial<WorkspaceFlowTree>, options: { transaction: Transaction }): Promise<unknown>;
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    if (!this.db.getCollection('flowModels')) return;
    const models = this.db.getRepository('flowModels') as unknown as Models;
    await this.db.sequelize.transaction(async (transaction) => {
      const options = { transaction, includeAsyncNode: true as const };
      const discussion = workspaceDiscussionTab();
      if (
        discussion.parentId &&
        (await models.findModelById(discussion.parentId, options)) &&
        !(await models.findModelById(discussion.uid, options))
      ) {
        await models.upsertModel(discussion, options);
      }
      const shipment = await models.findModelById('lcwspagediscussion', options);
      if (shipment?.use === 'ProcessDiscussionBlockModel') {
        await models.upsertModel(
          {
            uid: shipment.uid,
            props: { ...shipment.props, workspaceDiscussion: 'shipment' },
          },
          options,
        );
      }
    });
  }
}
