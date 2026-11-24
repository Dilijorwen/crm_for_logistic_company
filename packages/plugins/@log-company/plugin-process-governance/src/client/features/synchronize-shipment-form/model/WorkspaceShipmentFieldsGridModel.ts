/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { FormGridModel } from '@nocobase/client';
import type { FlowModel, GridCellV2, GridLayoutData, GridLayoutV2, GridRowV2 } from '@nocobase/flow-engine';

type FieldRow = Omit<GridRowV2, 'cells'> & { cells: Array<GridCellV2 & { items: [string] }> };

export class LogisticsWorkspaceShipmentFieldsGridModel extends FormGridModel {
  private isVisibleField(field: FlowModel): boolean {
    // Match the native renderer's row fork and observe its hidden state before ACL runs.
    const key = `${this.context.fieldKey}:${field.uid}`;
    const current = this.context.fieldIndex == null ? field : field.getFork(key) ?? field.createFork({}, key);
    // Native GridModel replaces the fork's local props while rendering. Designer visibility belongs to the field model.
    return !field.hidden && !field.props.hidden && !current.hidden && !current.forbidden;
  }

  getItemUids(): string[] {
    if (!this.context.isMobileLayout || this.context.flowSettingsEnabled) return super.getItemUids();
    // The native mobile projection appends items that are missing from the layout.
    return (this.subModels.items ?? [])
      .filter((item) => item.use !== 'FormItemModel' || this.isVisibleField(item))
      .map((item) => item.uid);
  }

  protected normalizeLayoutFromSource(source?: Partial<GridLayoutData>): GridLayoutV2 {
    const layout = super.normalizeLayoutFromSource(source);
    if (source || this.context.flowSettingsEnabled) return layout;

    const fields = new Map(
      (this.subModels.items ?? []).filter((item) => item.use === 'FormItemModel').map((item) => [item.uid, item]),
    );
    const result: GridRowV2[] = [];
    let fieldRows: FieldRow[] = [];

    const isVisible = (uid: string): boolean => {
      const field = fields.get(uid);
      return !field || this.isVisibleField(field);
    };

    const flush = () => {
      const original = fieldRows.flatMap((row) => row.cells.map((cell) => cell.items[0]));
      const visible = original.filter(isVisible);
      const regular: string[] = [];
      const checkboxes: string[] = [];
      for (const uid of visible) {
        const input = fields.get(uid)?.subModels?.field;
        (input && !Array.isArray(input) && input.use === 'CheckboxFieldModel' ? checkboxes : regular).push(uid);
      }

      if (
        visible.length === original.length &&
        [...regular, ...checkboxes].every((uid, index) => uid === original[index])
      ) {
        const checkboxRow = fieldRows.find((row) => row.cells.some((cell) => checkboxes.includes(cell.items[0])));
        if (!checkboxRow || checkboxRow.cells.every((cell) => checkboxes.includes(cell.items[0]))) {
          result.push(...fieldRows);
          fieldRows = [];
          return;
        }
      }

      let rowIndex = 0;
      for (const group of [regular, checkboxes]) {
        for (let index = 0; index < group.length; index += 2) {
          const cells = group.slice(index, index + 2).map((uid) => ({ id: uid, items: [uid] }));
          const row = fieldRows[rowIndex++];
          result.push({
            id: row?.id ?? `${this.uid}-checkboxes`,
            cells,
            sizes: row?.sizes?.length === cells.length ? row.sizes : cells.map(() => 24 / cells.length),
          });
        }
      }
      fieldRows = [];
    };

    const isFieldRow = (candidate: GridRowV2): candidate is FieldRow =>
      candidate.cells.length <= 2 &&
      candidate.cells.every((cell) => !cell.rows?.length && cell.items?.length === 1 && fields.has(cell.items[0]));

    for (const row of layout.rows) {
      const singleField = row.cells.length === 1 ? row.cells[0].items?.[0] : undefined;
      const path = singleField && fields.get(singleField)?.getStepParams('fieldSettings', 'init')?.fieldPath;
      const fullWidthStatus = path === 'status' || path === 'shipments.status';
      if (isFieldRow(row) && !fullWidthStatus) fieldRows.push(row);
      else {
        flush();
        if (!fullWidthStatus || (singleField && isVisible(singleField))) result.push(row);
      }
    }
    flush();
    return { ...layout, rows: result };
  }
}

LogisticsWorkspaceShipmentFieldsGridModel.define({ ...FormGridModel.meta, label: 'Поля поставки' });
