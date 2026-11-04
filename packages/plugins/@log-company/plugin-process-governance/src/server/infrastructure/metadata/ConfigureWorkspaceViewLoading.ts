/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database, Transaction } from '@nocobase/database';
import { assignWorkspaceParents, type WorkspaceFlowTree } from './LogisticsWorkspaceNativeModels';
import { shipmentCreationSections } from './WorkspaceShipmentFormSections';

const VIEW_BOUNDARIES = [
  'lcwsrecordpage',
  'lcwsruntabgrid',
  'lcwsshiptabgrid',
  'lcwsruntreetabgrid',
  'lcwsrunhistorytabgrid',
  'lcwsnewrunpage',
  'lcwsnewruntabgrid',
  'lcwsnewshippage',
  'lcwsnewshiptabgrid',
  'lcwsnewshipdocstabgrid',
  'lcwsshipmentfullpage',
  'lcwsshipmentfullgrid',
  'lcwsrsassoselectgrid',
];

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Persist native lazy boundaries, so view-dependent children are born inside their own popup. */
export async function configureWorkspaceViewLoading(db: Database, existingTransaction?: Transaction): Promise<void> {
  async function configure(transaction: Transaction) {
    const models = db.getRepository('flowModels') as unknown as {
      findModelById(
        uid: string,
        options: { transaction: Transaction; includeAsyncNode: boolean },
      ): Promise<WorkspaceFlowTree | null>;
      upsertModel(
        values: Partial<WorkspaceFlowTree> & { uid: string },
        options: { transaction: Transaction },
      ): Promise<unknown>;
      attach(
        uid: string,
        target: { parentId: string; subKey: string; subType: string; position: string },
        options: { transaction: Transaction },
      ): Promise<unknown>;
    };
    const options = { transaction, includeAsyncNode: true };
    async function attach(tree: WorkspaceFlowTree) {
      for (const [subKey, children] of Object.entries(tree.subModels || {})) {
        for (const child of Array.isArray(children) ? children : [children]) {
          await models.attach(
            child.uid,
            { parentId: tree.uid, subKey, subType: Array.isArray(children) ? 'array' : 'object', position: 'last' },
            { transaction },
          );
          await attach(child);
        }
      }
    }
    for (const uid of ['lcwsnewshipment', 'lcwsrsnew']) {
      const model = await models.findModelById(uid, options);
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
    const grid = await models.findModelById('lcwscreateshipgrid', options);
    if (grid && grid.use !== 'LogisticsWorkspaceShipmentSectionsGridModel') {
      const sections = shipmentCreationSections(grid);
      const documents = await models.findModelById('lcwscreatedocuments', options);
      if (documents) sections.push({ ...documents, props: { ...documents.props, workspaceSectionTitle: 'Документы' } });
      const grouped: WorkspaceFlowTree = {
        ...grid,
        use: 'LogisticsWorkspaceShipmentSectionsGridModel',
        subModels: { sections },
      };
      assignWorkspaceParents(grouped);
      await models.upsertModel(grouped, { transaction });
      await attach(grouped);
    }
    const page = await models.findModelById('lcwsnewshippage', options);
    if (page)
      await models.upsertModel(
        {
          uid: page.uid,
          stepParams: {
            ...page.stepParams,
            pageSettings: {
              ...object(page.stepParams?.pageSettings),
              general: {
                ...object(object(page.stepParams?.pageSettings).general),
                enableTabs: false,
                displayTitle: false,
              },
            },
          },
        },
        { transaction },
      );
    // upsertModel changes model options, while native async flags belong to each
    // node's depth-zero tree-path record. No fields or user records are recreated.
    const paths = db.getRepository('flowModelTreePath');
    for (const uid of VIEW_BOUNDARIES)
      await paths.update({
        filter: { ancestor: uid, descendant: uid, depth: 0 },
        values: { async: true },
        transaction,
      });
  }
  if (existingTransaction) return configure(existingTransaction);
  await db.sequelize.transaction(configure);
}
