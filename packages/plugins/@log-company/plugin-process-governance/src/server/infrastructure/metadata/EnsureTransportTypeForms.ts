/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database, Model, Transaction } from '@nocobase/database';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Adding a FormItem alone does not display it in a designer grid with an explicit layout. */
export async function ensureTransportTypeForms(db: Database, transaction: Transaction): Promise<void> {
  const repository = db.getRepository('flowModels');
  const models: Model[] = await repository.find({ transaction });
  const optionsOf = (model: Model) => record(model.get('options'));
  const paths: Model[] = await db.getRepository('flowModelTreePath').find({ filter: { depth: 1 }, transaction });
  const parents = new Map(paths.map((path) => [String(path.get('descendant')), String(path.get('ancestor'))]));
  const parentOf = (model: Model) => parents.get(String(model.get('uid'))) || optionsOf(model).parentId;
  const upsert = repository as unknown as {
    upsertModel(
      options: Record<string, unknown>,
      optionsWithTransaction: { transaction: Transaction },
    ): Promise<unknown>;
  };
  for (const form of models) {
    const options = optionsOf(form);
    const init = record(record(record(options.stepParams).resourceSettings).init);
    if (
      !['CreateFormModel', 'LogisticsWorkspaceCreateFormModel', 'EditFormModel'].includes(String(options.use)) ||
      init.collectionName !== 'transport_runs'
    )
      continue;
    const grid = models.find((model) => parentOf(model) === form.get('uid') && optionsOf(model).subKey === 'grid');
    if (!grid) continue;
    const gridUid = String(grid.get('uid'));
    const children = models.filter((model) => parentOf(model) === gridUid && optionsOf(model).subKey === 'items');
    const existing = children.find(
      (model) => record(record(record(optionsOf(model).stepParams).fieldSettings).init).fieldPath === 'transport_type',
    );
    const fieldUid = existing ? String(existing.get('uid')) : `lcmode${form.get('uid')}`;
    await upsert.upsertModel(
      {
        uid: fieldUid,
        use: 'FormItemModel',
        parentId: gridUid,
        subKey: 'items',
        subType: 'array',
        stepParams: {
          ...record(existing && optionsOf(existing).stepParams),
          fieldSettings: {
            init: { dataSourceKey: 'main', collectionName: 'transport_runs', fieldPath: 'transport_type' },
          },
          editItemSettings: {
            ...record(record(existing && optionsOf(existing).stepParams).editItemSettings),
            required: { required: true },
          },
        },
        subModels: {
          field: {
            uid: existing
              ? String(
                  models
                    .find((model) => parentOf(model) === fieldUid && optionsOf(model).subKey === 'field')
                    ?.get('uid') || `${fieldUid}input`,
                )
              : `${fieldUid}input`,
            use: 'SelectFieldModel',
            parentId: fieldUid,
            subKey: 'field',
            subType: 'object',
          },
        },
      },
      { transaction },
    );
    const gridOptions = optionsOf(grid);
    const stepParams = record(gridOptions.stepParams);
    const gridSettings = record(stepParams.gridSettings);
    const settings = record(gridSettings.grid);
    const layout = record(settings.layout);
    let next = settings;
    if (layout.version === 2 && Array.isArray(layout.rows)) {
      const contains = layout.rows.some((row) => {
        const cells = record(row).cells;
        return (
          Array.isArray(cells) &&
          cells.some(
            (cell) => Array.isArray(record(cell).items) && (record(cell).items as unknown[]).includes(fieldUid),
          )
        );
      });
      if (contains) continue;
      const rowUid = `${gridUid}transportType`;
      next = {
        ...settings,
        layout: {
          ...layout,
          rows: [{ id: rowUid, cells: [{ id: `${rowUid}:cell:0`, items: [fieldUid] }], sizes: [24] }, ...layout.rows],
        },
      };
    } else {
      const rows = record(settings.rows);
      if (
        Object.values(rows).some(
          (row) => Array.isArray(row) && row.some((cell) => Array.isArray(cell) && cell.includes(fieldUid)),
        )
      )
        continue;
      const rowUid = `${gridUid}transportType`;
      const existingRows = Object.keys(rows).length
        ? rows
        : Object.fromEntries(
            children
              .filter((child) => child !== existing)
              .map((child, index) => [`${gridUid}existing${index}`, [[String(child.get('uid'))]]]),
          );
      next = {
        ...settings,
        rows: { [rowUid]: [[fieldUid]], ...existingRows },
        sizes: { ...record(settings.sizes), [rowUid]: [24] },
      };
    }
    await upsert.upsertModel(
      { uid: gridUid, stepParams: { ...stepParams, gridSettings: { ...gridSettings, grid: next } } },
      { transaction },
    );
  }
}
