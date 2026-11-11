/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Model, Transaction } from '@nocobase/database';
import { Migration } from '@nocobase/server';
import fieldLayout from '../infrastructure/metadata/permitDocumentFieldLayout.json';

interface BlockFieldLayout {
  uid: string;
  use: string;
  collectionName: string;
  grid: { uid: string; settings: Record<string, unknown> | null } | null;
  fields: { uid: string; fieldPath: string; sort: number; columnSettings: Record<string, unknown> | null }[];
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export default class PreserveFieldLayoutsAndEnableRegulationEditing extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await this.db.sequelize.transaction(async (transaction) => {
      const field = await this.db.getRepository('fields').findOne({
        filter: { collectionName: 'permit_documents', name: 'technical_regulations' },
        transaction,
      });
      if (field) {
        const options = object(field.get('options'));
        const uiSchema = object(options.uiSchema);
        await field.update(
          {
            options: {
              ...options,
              uiSchema: {
                ...uiSchema,
                'x-component-props': { ...object(uiSchema['x-component-props']), disabled: false },
              },
            },
          },
          { transaction },
        );
      }
      await this.restoreFieldLayouts(transaction);
    });
  }

  private async restoreFieldLayouts(transaction: Transaction): Promise<void> {
    if (!this.db.getCollection('flowModels')) return;
    const layouts: BlockFieldLayout[] = fieldLayout.blocks;
    const parentIds = layouts.flatMap((block) => [block.uid, ...(block.grid ? [block.grid.uid] : [])]);
    const paths: Model[] = await this.db.getRepository('flowModelTreePath').find({
      filter: { depth: 1, ancestor: { $in: parentIds } },
      transaction,
    });
    const modelIds = [...new Set([...parentIds, ...paths.map((path) => String(path.get('descendant')))])];
    const models: Model[] = await this.db.getRepository('flowModels').find({
      filter: { uid: { $in: modelIds } },
      transaction,
    });
    const byId = new Map(models.map((model) => [String(model.get('uid')), model]));
    const optionsOf = (uid: string) => object(byId.get(uid)?.get('options'));

    for (const layout of layouts) {
      const blockOptions = optionsOf(layout.uid);
      const init = object(object(object(blockOptions.stepParams).resourceSettings).init);
      if (
        blockOptions.use !== layout.use ||
        init.collectionName !== layout.collectionName ||
        (init.dataSourceKey ?? 'main') !== fieldLayout.dataSourceKey
      )
        continue;
      const parentUid = layout.grid?.uid ?? layout.uid;
      if (
        layout.grid &&
        !paths.some((path) => path.get('ancestor') === layout.uid && path.get('descendant') === parentUid)
      )
        continue;
      const items = paths.filter(
        (path) =>
          path.get('ancestor') === parentUid &&
          optionsOf(String(path.get('descendant'))).subKey === (layout.grid ? 'items' : 'columns'),
      );
      // A changed field set belongs to a newer designer configuration and must keep its own layout.
      if (
        items.length !== layout.fields.length ||
        layout.fields.some(
          (field) =>
            !items.some((item) => item.get('descendant') === field.uid) ||
            object(object(object(optionsOf(field.uid).stepParams).fieldSettings).init).fieldPath !== field.fieldPath,
        )
      )
        continue;

      const grid = byId.get(parentUid);
      if (layout.grid && grid) {
        const options = optionsOf(parentUid);
        const stepParams = object(options.stepParams);
        await grid.update(
          {
            options: {
              ...options,
              stepParams: {
                ...stepParams,
                gridSettings: { ...object(stepParams.gridSettings), grid: layout.grid.settings ?? {} },
              },
            },
          },
          { transaction },
        );
      }
      for (const field of layout.fields) {
        const path = items.find((item) => item.get('descendant') === field.uid);
        const model = byId.get(field.uid);
        if (!path || !model) continue;
        await path.update({ sort: field.sort }, { transaction });
        if (!field.columnSettings) continue;
        const options = optionsOf(field.uid);
        await model.update(
          {
            options: {
              ...options,
              stepParams: { ...object(options.stepParams), tableColumnSettings: field.columnSettings },
            },
          },
          { transaction },
        );
      }
    }
  }
}
