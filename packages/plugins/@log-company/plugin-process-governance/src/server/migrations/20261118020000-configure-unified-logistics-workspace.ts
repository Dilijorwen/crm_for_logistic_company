/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import type { Model, Transaction } from '@nocobase/database';
import {
  assignWorkspaceParents,
  workspaceSourceForm,
  type WorkspaceFlowTree,
} from '../infrastructure/metadata/LogisticsWorkspaceNativeModels';
import { configureUnifiedRunForm } from '../infrastructure/metadata/UnifiedWorkspaceForm';

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
    await this.db.sequelize.transaction(async (transaction) => {
      await this.grantDeclarantCommentAccess(transaction);
      const models = this.db.getRepository('flowModels') as unknown as Models;
      const options = { transaction, includeAsyncNode: true } as const;
      for (const uid of ['lcwscreaterun', 'lcwsrunform']) {
        const form = await models.findModelById(uid, options);
        if (!form?.subModels?.grid) continue;
        await models.upsertModel(configureUnifiedRunForm(form, uid === 'lcwscreaterun'), { transaction });
      }
      const table = await models.findModelById('lcwsgroupedtable', options);
      if (table) {
        const links = workspaceSourceForm('lcwssidelinks', 'transport_runs', ['parent_runs']);
        links.parentId = table.uid;
        links.subKey = 'sidebarTemplates';
        links.subType = 'array';
        assignWorkspaceParents(links);
        await models.upsertModel(links, { transaction });
      }
      const action = await models.findModelById('lcwsdeleteshipment', options);
      if (action)
        await models.upsertModel(
          {
            uid: action.uid,
            props: { ...action.props, iconOnly: true, tooltip: 'Удалить', 'aria-label': 'Удалить выбранные поставки' },
          },
          { transaction },
        );
    });
  }

  private async grantDeclarantCommentAccess(transaction: Transaction): Promise<void> {
    if (!this.db.getCollection('dataSourcesRolesResourcesActions')) return;
    const rules: Model[] = await this.db.getRepository('dataSourcesRolesResources').find({
      filter: { dataSourceKey: 'main', name: 'shipments' },
      fields: ['id'],
      transaction,
    });
    if (!rules.length) return;
    const actions = await this.db.getRepository('dataSourcesRolesResourcesActions').find({
      filter: { rolesResourceId: { $in: rules.map((rule) => rule.get('id')) } },
      transaction,
    });
    for (const action of actions) {
      const fields: unknown = action.get('fields');
      if (Array.isArray(fields) && fields.includes('declaration_number') && !fields.includes('declarant_comment')) {
        await action.update({ fields: [...fields, 'declarant_comment'] }, { transaction });
      }
    }
  }
}
