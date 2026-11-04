/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ensureTransportTypeForms } from './EnsureTransportTypeForms';
import type { Database, Transaction } from '@nocobase/database';
import {
  logisticsWorkspaceNativeTrees,
  WORKSPACE_RECORD_POPUP_UID,
  type WorkspaceFlowTree,
} from './LogisticsWorkspaceNativeModels';

interface FlowRecord {
  get(name: string): unknown;
}
interface FlowRepository {
  findOne(options: { filter: Record<string, unknown>; transaction: Transaction }): Promise<FlowRecord | null>;
  upsertModel(
    node: Record<string, unknown> | WorkspaceFlowTree,
    options: { transaction: Transaction },
  ): Promise<unknown>;
  remove(uid: string, options: { transaction: Transaction }): Promise<unknown>;
  attach(
    uid: string,
    target: { parentId: string; subKey: string; subType: 'array' | 'object'; position: 'last' },
    options: { transaction: Transaction },
  ): Promise<unknown>;
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export async function upgradeLogisticsWorkspace(db: Database, transaction?: Transaction): Promise<void> {
  const upgrade = async (transaction: Transaction) => {
    const models = db.getRepository('flowModels') as unknown as FlowRepository;
    for (const uid of [
      'lcwsrefresh',
      'lcwsassociate',
      'lcwsrunlinksform',
      'lclogworkrun',
      'lclogworklinks',
      'lclogworkshipment',
      'lclogworkdelete',
    ]) {
      if (await models.findOne({ filter: { uid }, transaction })) await models.remove(uid, { transaction });
    }
    const trees = logisticsWorkspaceNativeTrees();
    for (const tree of trees) await models.upsertModel(tree, { transaction });
    async function reconcile(tree: WorkspaceFlowTree) {
      if (tree.parentId && tree.subKey && tree.subType) {
        const connected = await db
          .getRepository('flowModelTreePath')
          .count({ filter: { ancestor: tree.parentId, descendant: tree.uid, depth: 1 }, transaction });
        if (!connected)
          await models.attach(
            tree.uid,
            { parentId: tree.parentId, subKey: tree.subKey, subType: tree.subType, position: 'last' },
            { transaction },
          );
      }
      for (const value of Object.values(tree.subModels || {}))
        for (const child of Array.isArray(value) ? value : [value]) await reconcile(child);
    }
    for (const tree of trees) await reconcile(tree);
    const oldColumnChildren = await db
      .getRepository('flowModelTreePath')
      .count({ filter: { ancestor: 'lclogworkspaceactions', depth: 1 }, transaction });
    if (!oldColumnChildren && (await models.findOne({ filter: { uid: 'lclogworkspaceactions' }, transaction })))
      await models.remove('lclogworkspaceactions', { transaction });
    // The wrapper decorates the standard TableBlockModel, preserving all native features and personalization.
    await models.upsertModel(
      {
        uid: 'lcwsgroupedtable',
        use: 'LogisticsWorkspaceTableBlockModel',
        parentId: 'lclogworkspacegrid',
        subKey: 'items',
        subType: 'array',
      },
      { transaction },
    );
    await models.attach(
      'lclogworkspacetable',
      { parentId: 'lcwsgroupedtable', subKey: 'table', subType: 'object', position: 'last' },
      { transaction },
    );
    const table = await models.findOne({ filter: { uid: 'lclogworkspacetable' }, transaction });
    if (!table) throw new Error('Не найдена таблица общего рабочего списка.');
    const steps = record(record(table.get('options')).stepParams);
    await models.upsertModel(
      {
        uid: 'lclogworkspacetable',
        stepParams: {
          ...steps,
          tableSettings: {
            ...record(steps.tableSettings),
            tableDensity: { size: 'small' },
            defaultSorting: {
              sort: [
                { field: 'transport_type', direction: 'asc' },
                { field: 'run_number', direction: 'asc' },
                { field: 'shipment_number', direction: 'asc' },
              ],
            },
          },
        },
      },
      { transaction },
    );
    const paths = await db
      .getRepository('flowModelTreePath')
      .find({ filter: { ancestor: 'lclogworkspacetable', depth: 1 }, transaction });
    let shipmentColumn: string | undefined;
    for (const path of paths) {
      const uid = String(path.get('descendant'));
      const column = await models.findOne({ filter: { uid }, transaction });
      const options = record(column?.get('options'));
      if (options.use !== 'TableColumnModel') continue;
      const columnSteps = record(options.stepParams);
      const binding = record(record(columnSteps.fieldSettings).init);
      const fieldPath = binding.fieldPath === 'shipment_display_name' ? 'shipment_number' : binding.fieldPath;
      if (fieldPath === 'shipment_number') {
        if (shipmentColumn) {
          await models.remove(uid, { transaction });
          continue;
        }
        shipmentColumn = uid;
      }
      if (!['run_number', 'registration_number', 'shipment_number'].includes(String(fieldPath))) continue;
      await models.upsertModel(
        {
          uid,
          stepParams: {
            ...columnSteps,
            fieldSettings: { init: { ...binding, fieldPath } },
            tableColumnSettings: {
              ...record(columnSteps.tableColumnSettings),
              model: { use: 'LogisticsWorkspaceRecordFieldModel' },
            },
          },
        },
        { transaction },
      );
      const childPaths = await db
        .getRepository('flowModelTreePath')
        .find({ filter: { ancestor: uid, depth: 1 }, transaction });
      for (const child of childPaths) {
        await models.upsertModel(
          {
            uid: String(child.get('descendant')),
            use: 'LogisticsWorkspaceRecordFieldModel',
            stepParams: {
              displayFieldSettings: { clickToOpen: { clickToOpen: true } },
              popupSettings: {
                openView: {
                  uid: WORKSPACE_RECORD_POPUP_UID,
                  collectionName: 'logistics_work_items',
                  dataSourceKey: 'main',
                  navigation: false,
                  size: 'large',
                },
              },
            },
          },
          { transaction },
        );
      }
    }
    await models.upsertModel(
      {
        uid: 'lcwstransportcolumn',
        use: 'TableColumnModel',
        parentId: 'lclogworkspacetable',
        subKey: 'columns',
        subType: 'array',
        stepParams: {
          fieldSettings: {
            init: { dataSourceKey: 'main', collectionName: 'logistics_work_items', fieldPath: 'transport_type' },
          },
        },
        subModels: {
          field: {
            uid: 'lcwstransportfield',
            use: 'DisplayEnumFieldModel',
            parentId: 'lcwstransportcolumn',
            subKey: 'field',
            subType: 'object',
          },
        },
      },
      { transaction },
    );
    await ensureTransportTypeForms(db, transaction);
  };
  if (transaction) await upgrade(transaction);
  else await db.sequelize.transaction(upgrade);
}
