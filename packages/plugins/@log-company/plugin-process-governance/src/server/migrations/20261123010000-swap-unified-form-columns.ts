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
import type { WorkspaceFlowTree } from '../infrastructure/metadata/LogisticsWorkspaceNativeModels';

interface GridCell {
  items?: string[];
  rows?: GridRow[];
}

interface GridRow {
  id: string;
  cells: GridCell[];
  sizes?: number[];
}

interface GridSettings {
  rows?: Record<string, string[][]>;
  sizes?: Record<string, number[]>;
  layout?: { rows: GridRow[] };
}

type Options = { transaction: Transaction; includeAsyncNode: true };
interface Models {
  findModelById(uid: string, options: Options): Promise<WorkspaceFlowTree | null>;
  upsertModel(model: Partial<WorkspaceFlowTree>, options: Options): Promise<unknown>;
}

function containsItem(cell: GridCell, uid: string): boolean {
  return Boolean(
    cell.items?.includes(uid) || cell.rows?.some((row) => row.cells.some((child) => containsItem(child, uid))),
  );
}

function swapColumns(grid: GridSettings | undefined, shipmentUid: string): GridSettings | undefined {
  if (!grid) return;
  const details = grid.rows?.details;
  const swapLegacy = details?.length === 2 && !details[0].includes(shipmentUid) && details[1].includes(shipmentUid);
  const sizes = grid.sizes?.details;
  const layout = grid.layout;
  const row = layout?.rows.find((item) => item.id === 'details');
  const swapLayout =
    row?.cells.length === 2 && !containsItem(row.cells[0], shipmentUid) && containsItem(row.cells[1], shipmentUid);
  if (!swapLegacy && !swapLayout) return;

  return {
    ...grid,
    ...(swapLegacy && {
      rows: { ...grid.rows, details: [details[1], details[0]] },
      ...(sizes?.length === 2 && { sizes: { ...grid.sizes, details: [sizes[1], sizes[0]] } }),
    }),
    ...(swapLayout &&
      layout && {
        layout: {
          ...layout,
          rows: layout.rows.map((item) =>
            item === row
              ? {
                  ...row,
                  cells: [row.cells[1], row.cells[0]],
                  ...(row.sizes?.length === 2 && { sizes: [row.sizes[1], row.sizes[0]] }),
                }
              : item,
          ),
        },
      }),
  };
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    if (!this.db.getCollection('flowModels')) return;
    const models = this.db.getRepository('flowModels') as unknown as Models;
    await this.db.sequelize.transaction(async (transaction) => {
      const options: Options = { transaction, includeAsyncNode: true };
      for (const formUid of ['lcwscreaterun', 'lcwsrunform']) {
        const uid = `${formUid}grid`;
        const model = await models.findModelById(uid, options);
        if (!model) continue;
        const shipmentUid = `${formUid}unifiedshipment`;
        const settings = model.stepParams?.gridSettings as { grid?: GridSettings } | undefined;
        const grid = swapColumns(settings?.grid, shipmentUid);
        const props = swapColumns(model.props, shipmentUid);
        if (grid || props) {
          await models.upsertModel(
            {
              uid,
              ...(grid && { stepParams: { ...model.stepParams, gridSettings: { ...settings, grid } } }),
              ...(props && { props: { ...props } }),
            },
            options,
          );
        }
      }
    });
  }
}
