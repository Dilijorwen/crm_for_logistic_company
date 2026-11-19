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
import { workspaceSelectorUpdate } from '../infrastructure/metadata/WorkspaceSelectorScopes';

interface Models {
  findModelById(
    uid: string,
    options: { transaction: Transaction; includeAsyncNode: true },
  ): Promise<WorkspaceFlowTree | null>;
  upsertModel(model: Partial<WorkspaceFlowTree>, options: { transaction: Transaction }): Promise<unknown>;
}

const workspaceForms = ['lcwscreaterun', 'lcwsrunform', 'lcwscreateship', 'lcwspageform', 'lcwsshipform'];

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await this.db.sequelize.transaction(async (transaction) => {
      const models = this.db.getRepository('flowModels') as unknown as Models;
      async function updateFields(node: WorkspaceFlowTree): Promise<void> {
        const update = workspaceSelectorUpdate(node);
        if (update) await models.upsertModel(update, { transaction });
        for (const child of Object.values(node.subModels ?? {})) {
          for (const item of Array.isArray(child) ? child : [child]) await updateFields(item);
        }
      }
      for (const uid of workspaceForms) {
        const form = await models.findModelById(uid, { transaction, includeAsyncNode: true });
        if (form) await updateFields(form);
      }
    });
  }
}
