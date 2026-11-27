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
import { WORKSPACE_DELETION_ACTION } from '../../shared/workspace';
import {
  WORKSPACE_DELETE_UID,
  type WorkspaceFlowTree,
} from '../infrastructure/metadata/LogisticsWorkspaceNativeModels';

interface Models {
  findModelById(uid: string, options: { transaction: Transaction }): Promise<WorkspaceFlowTree | null>;
  upsertModel(
    model: Pick<WorkspaceFlowTree, 'uid' | 'use' | 'props'>,
    options: { transaction: Transaction },
  ): Promise<unknown>;
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    if (!this.db.getCollection('flowModels')) return;
    const models = this.db.getRepository('flowModels') as unknown as Models;
    await this.db.sequelize.transaction(async (transaction) => {
      const current = await models.findModelById(WORKSPACE_DELETE_UID, { transaction });
      if (!current || current.use !== 'LogisticsWorkspaceBulkDeleteActionModel') return;
      await models.upsertModel(
        {
          uid: current.uid,
          use: WORKSPACE_DELETION_ACTION,
          props: { ...current.props, iconOnly: true, tooltip: 'Удалить', 'aria-label': 'Удалить рейсы и поставки' },
        },
        { transaction },
      );
    });
  }
}
