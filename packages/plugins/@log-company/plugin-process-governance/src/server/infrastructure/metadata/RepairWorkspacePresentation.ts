/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database, Transaction } from '@nocobase/database';
import {
  WORKSPACE_RUN_VIEW_UID,
  WORKSPACE_SHIPMENT_VIEW_UID,
  WORKSPACE_CREATE_SHIPMENT_VIEW_UID,
} from '../../../shared/workspace';

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Repair only affected ownership and view settings, retaining designer fields and personal layouts. */
export async function repairWorkspacePresentation(db: Database, existingTransaction?: Transaction): Promise<void> {
  async function repair(transaction: Transaction) {
    const repository = db.getRepository('flowModels') as unknown as {
      findOne(options: {
        filter: { uid: string };
        transaction: Transaction;
      }): Promise<{ get(key: string): unknown } | null>;
      upsertModel(values: Record<string, unknown>, options: { transaction: Transaction }): Promise<unknown>;
      attach(
        uid: string,
        position: { parentId: string; subKey: string; subType: string; position: string },
        options: { transaction: Transaction },
      ): Promise<unknown>;
    };
    for (const [uid, parentId] of [
      ['lcwsrunform', 'lcwsruncontextgrid'],
      ['lcwscreateship', 'lcwsnewshipcontextgrid'],
    ]) {
      if (!(await repository.findOne({ filter: { uid }, transaction }))) continue;
      await repository.upsertModel({ uid, parentId, subKey: 'items', subType: 'array' }, { transaction });
      await repository.attach(uid, { parentId, subKey: 'items', subType: 'array', position: 'last' }, { transaction });
    }
    for (const uid of [WORKSPACE_RUN_VIEW_UID, WORKSPACE_SHIPMENT_VIEW_UID, WORKSPACE_CREATE_SHIPMENT_VIEW_UID]) {
      const model = await repository.findOne({ filter: { uid }, transaction });
      if (!model) continue;
      const steps = object(object(model.get('options')).stepParams);
      const popup = object(steps.popupSettings);
      await repository.upsertModel(
        {
          uid,
          use: 'LogisticsWorkspacePopupActionModel',
          stepParams: {
            ...steps,
            popupSettings: { ...popup, openView: { ...object(popup.openView), navigation: true } },
          },
        },
        { transaction },
      );
    }
    if (await repository.findOne({ filter: { uid: 'lcwsnewshippage' }, transaction }))
      await repository.upsertModel({ uid: 'lcwsnewshippage', use: 'ChildPageModel' }, { transaction });
    await db
      .getRepository('desktopRoutes')
      .update({ filter: { schemaUid: 'lclogworkspace' }, values: { icon: null }, transaction });
    const column = await repository.findOne({ filter: { uid: 'lcwsrsactions' }, transaction });
    if (column)
      await repository.upsertModel(
        { uid: 'lcwsrsactions', props: { ...object(object(column.get('options')).props), width: 56 } },
        { transaction },
      );
  }
  if (existingTransaction) return repair(existingTransaction);
  await db.sequelize.transaction(repair);
}
