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
    if (current !== field && !Object.prototype.hasOwnProperty.call(current.context, 'fieldPathArray')) {
      const fieldPath = field.getStepParams('fieldSettings', 'init')?.fieldPath;
      if (typeof fieldPath === 'string' && fieldPath) {
        // A field hidden before renderItem still needs its own path for native submission filtering.
        current.context.defineProperty('fieldPathArray', {
          get: () => fieldPath.split('.'),
          cache: false,
        });
      }
    }
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
    const checkboxes: FieldRow['cells'] = [];
    let previousSingle: GridRowV2 | undefined;

    const isVisible = (uid: string): boolean => {
      const field = fields.get(uid);
      return !field || this.isVisibleField(field);
    };

    const flushCheckboxes = () => {
      for (let index = 0; index < checkboxes.length; index += 2) {
        const cells = checkboxes.slice(index, index + 2);
        result.push({
          id: `${this.uid}-checkboxes-${cells[0].items[0]}`,
          cells,
          sizes: cells.map(() => 24 / cells.length),
        });
      }
      checkboxes.length = 0;
      previousSingle = undefined;
    };

    const isFieldRow = (candidate: GridRowV2): candidate is FieldRow =>
      candidate.cells.length <= 2 &&
      candidate.cells.every((cell) => !cell.rows?.length && cell.items?.length === 1 && fields.has(cell.items[0]));

    for (const row of layout.rows) {
      const singleField = row.cells.length === 1 ? row.cells[0].items?.[0] : undefined;
      const path = singleField && fields.get(singleField)?.getStepParams('fieldSettings', 'init')?.fieldPath;
      const fullWidthStatus = path === 'status' || path === 'shipments.status';
      if (!isFieldRow(row) || fullWidthStatus) {
        flushCheckboxes();
        if (!fullWidthStatus || (singleField && isVisible(singleField))) result.push(row);
        continue;
      }

      const checkboxCount = checkboxes.length;
      const cells = row.cells.filter((cell) => {
        const uid = cell.items[0];
        if (!isVisible(uid)) return false;
        const input = fields.get(uid)?.subModels?.field;
        if (!input || Array.isArray(input) || input.use !== 'CheckboxFieldModel') return true;
        checkboxes.push(cell);
        return false;
      });
      if (!cells.length) continue;

      const isPartialPair = row.cells.length === 2 && cells.length === 1 && checkboxes.length === checkboxCount;
      if (isPartialPair && previousSingle) {
        previousSingle.cells.push(cells[0]);
        previousSingle.sizes = [12, 12];
        previousSingle = undefined;
        continue;
      }

      const visibleRow = cells.length === row.cells.length ? row : { ...row, cells, sizes: [24] };
      result.push(visibleRow);
      previousSingle = isPartialPair ? visibleRow : undefined;
    }
    flushCheckboxes();
    return { ...layout, rows: result };
  }
}

LogisticsWorkspaceShipmentFieldsGridModel.define({ ...FormGridModel.meta, label: 'Поля поставки' });
