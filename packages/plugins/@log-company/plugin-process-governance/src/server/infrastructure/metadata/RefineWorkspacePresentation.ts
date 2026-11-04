/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database, Transaction } from '@nocobase/database';
import { workspaceRunFormSections } from './WorkspaceRunFormSections';
import { assignWorkspaceParents, workspaceColumn, type WorkspaceFlowTree } from './LogisticsWorkspaceNativeModels';

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Narrow upgrade: preserve field UIDs, actions, column settings and route grants. */
export async function refineWorkspacePresentation(db: Database, existingTransaction?: Transaction): Promise<void> {
  async function update(transaction: Transaction) {
    const models = db.getRepository('flowModels') as unknown as {
      findModelById(uid: string, options: { transaction: Transaction }): Promise<WorkspaceFlowTree | null>;
      upsertModel(
        values: Partial<WorkspaceFlowTree> & { uid: string },
        options: { transaction: Transaction },
      ): Promise<unknown>;
      attach(
        uid: string,
        position: { parentId: string; subKey: string; subType: string; position: string },
        options: { transaction: Transaction },
      ): Promise<unknown>;
    };
    await db.getRepository('desktopRoutes').update({
      filter: { schemaUid: 'lclogworkspace' },
      values: { title: 'Рейсы и поставки', icon: null },
      transaction,
    });
    for (const uid of ['lcwsadd', 'lclogworknewrun', 'lcwsrecordpopup']) {
      const model = await models.findModelById(uid, { transaction });
      if (!model) continue;
      const popup = object(model.stepParams?.popupSettings);
      await models.upsertModel(
        {
          uid,
          stepParams: {
            ...model.stepParams,
            popupSettings: { ...popup, openView: { ...object(popup.openView), mode: 'dialog', size: 'large' } },
          },
        },
        { transaction },
      );
    }
    for (const uid of ['lcwscreaterungrid', 'lcwsrunformgrid']) {
      const grid = await models.findModelById(uid, { transaction });
      if (!grid) continue;
      const grouped = workspaceRunFormSections(grid);
      if (grouped === grid) continue;
      assignWorkspaceParents(grouped);
      await models.upsertModel(grouped, { transaction });
      for (const item of (grouped.subModels?.items || []) as WorkspaceFlowTree[])
        await models.attach(
          item.uid,
          { parentId: uid, subKey: 'items', subType: 'array', position: 'last' },
          { transaction },
        );
    }
    for (const uid of ['lclogworkspacetable', 'lcwsrunshipments', 'lcwsrsassoselecttable']) {
      const table = await models.findModelById(uid, { transaction });
      if (!table) continue;
      for (const column of (table.subModels?.columns || []) as WorkspaceFlowTree[]) {
        const init = object(object(column.stepParams?.fieldSettings).init);
        const field = column.subModels?.field as WorkspaceFlowTree | undefined;
        if (
          !field ||
          field.use !== 'DisplayTextFieldModel' ||
          typeof init.fieldPath !== 'string' ||
          typeof init.collectionName !== 'string'
        )
          continue;
        const native = workspaceColumn('binding', init.collectionName, init.fieldPath).subModels
          ?.field as WorkspaceFlowTree;
        if (native.use === 'DisplayTextFieldModel') continue;
        await models.upsertModel({ uid: field.uid, use: native.use }, { transaction });
        await models.upsertModel(
          {
            uid: column.uid,
            stepParams: {
              ...column.stepParams,
              tableColumnSettings: { ...object(column.stepParams?.tableColumnSettings), model: { use: native.use } },
            },
          },
          { transaction },
        );
      }
    }
  }
  if (existingTransaction) return update(existingTransaction);
  await db.sequelize.transaction(update);
}
