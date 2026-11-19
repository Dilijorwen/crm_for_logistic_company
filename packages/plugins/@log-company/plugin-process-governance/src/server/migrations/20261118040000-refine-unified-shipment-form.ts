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
  SHIPMENT_CUSTOMS,
  SHIPMENT_NTM,
  WORKSPACE_ADD_UID,
  type WorkspaceFlowTree,
} from '../infrastructure/metadata/LogisticsWorkspaceNativeModels';
import { workspaceUnifiedShipmentPicker } from '../infrastructure/metadata/WorkspaceAssociatedShipmentsTree';

type FindOptions = { transaction: Transaction; includeAsyncNode: true };
interface Models {
  findModelById(uid: string, options: FindOptions): Promise<WorkspaceFlowTree | null>;
  upsertModel(model: Partial<WorkspaceFlowTree>, options: { transaction: Transaction }): Promise<unknown>;
  attach(
    uid: string,
    parent: { parentId: string; subKey: 'items'; subType: 'array'; position: 'last' },
    options: { transaction: Transaction },
  ): Promise<unknown>;
}

const SECTIONS = [
  { key: 'invoice', title: 'Инвойс и товары', fields: ['invoice_number', 'invoice_value', 'goods_count'] },
  { key: 'customs', title: 'Таможенное оформление', fields: SHIPMENT_CUSTOMS },
  { key: 'ntm', title: 'НТМ', fields: SHIPMENT_NTM },
];

function fieldPath(model: WorkspaceFlowTree) {
  const settings = model.stepParams?.fieldSettings as { init?: { fieldPath?: string } } | undefined;
  return settings?.init?.fieldPath;
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await this.db.sequelize.transaction(async (transaction) => {
      const models = this.db.getRepository('flowModels') as unknown as Models;
      const options: FindOptions = { transaction, includeAsyncNode: true };
      for (const uid of ['lcwscreaterununifiedshipmentfield', 'lcwsrunformunifiedshipmentfield']) {
        const field = await models.findModelById(uid, options);
        if (!field) continue;
        await models.upsertModel(
          {
            uid,
            stepParams: {
              ...field.stepParams,
              selectExitRecordSettings: { openView: { mode: 'dialog', size: 'large' } },
            },
          },
          options,
        );
        const picker = workspaceUnifiedShipmentPicker(uid);
        if (!(await models.findModelById(picker.uid, options))) await models.upsertModel(picker, options);
        const grid = field.subModels?.grid;
        if (grid && !Array.isArray(grid)) await this.foldSections(models, grid, options);
      }

      for (const uid of ['lclogworkspacetable', 'lcwsrunshipments']) {
        const table = await models.findModelById(uid, options);
        const columns = table?.subModels?.columns;
        if (!Array.isArray(columns)) continue;
        for (const column of columns.filter((candidate) => fieldPath(candidate) === 'shipment_number')) {
          const field = column.subModels?.field;
          if (!field || Array.isArray(field)) continue;
          const display = field.stepParams?.displayFieldSettings as Record<string, unknown> | undefined;
          await models.upsertModel(
            {
              uid: field.uid,
              stepParams: {
                ...field.stepParams,
                displayFieldSettings: { ...display, clickToOpen: { clickToOpen: false } },
              },
            },
            options,
          );
        }
      }
      const action = await models.findModelById(WORKSPACE_ADD_UID, options);
      if (!action) return;
      const title = 'Добавить процесс';
      const button = action.stepParams?.buttonSettings as { general?: Record<string, unknown> } | undefined;
      await models.upsertModel(
        {
          uid: action.uid,
          props: { ...action.props, title },
          stepParams: { ...action.stepParams, buttonSettings: { ...button, general: { ...button?.general, title } } },
        },
        options,
      );
    });
  }

  private async foldSections(models: Models, grid: WorkspaceFlowTree, options: FindOptions): Promise<void> {
    const fields = grid.subModels?.items;
    if (!Array.isArray(fields)) return;
    const groupedIds = new Set<string>();
    const sectionRows: Record<string, string[][]> = {};
    for (const section of SECTIONS) {
      const items = fields.filter((field) => section.fields.some((name) => fieldPath(field) === `shipments.${name}`));
      if (!items.length) continue;
      const uid = `${grid.uid}${section.key}`;
      const rows = Object.fromEntries(
        Array.from({ length: Math.ceil(items.length / 2) }, (_, index) => [
          `${uid}row${index}`,
          items.slice(index * 2, index * 2 + 2).map((item) => [item.uid]),
        ]),
      );
      await models.upsertModel(
        {
          uid,
          parentId: grid.uid,
          subKey: 'items',
          subType: 'array',
          use: 'LogisticsWorkspaceShipmentFoldGridModel',
          props: { workspaceSectionTitle: section.title },
          stepParams: { gridSettings: { grid: { rows } } },
        },
        options,
      );
      for (const item of items) {
        await models.attach(item.uid, { parentId: uid, subKey: 'items', subType: 'array', position: 'last' }, options);
        groupedIds.add(item.uid);
      }
      sectionRows[uid] = [[uid]];
    }
    if (!groupedIds.size) return;
    const settings = grid.stepParams?.gridSettings as { grid?: { rows?: Record<string, string[][]> } } | undefined;
    const rows = Object.fromEntries(
      Object.entries(settings?.grid?.rows || {})
        .map(([key, columns]) => [
          key,
          columns.map((items) => items.filter((uid) => !groupedIds.has(uid))).filter((items) => items.length),
        ])
        .filter(([, columns]) => columns.length),
    );
    await models.upsertModel(
      {
        uid: grid.uid,
        stepParams: { ...grid.stepParams, gridSettings: { ...settings, grid: { rows: { ...rows, ...sectionRows } } } },
      },
      options,
    );
  }
}
