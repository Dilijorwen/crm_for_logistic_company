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

type Options = { transaction: Transaction; includeAsyncNode: true };
interface Models {
  findModelById(uid: string, options: Options): Promise<WorkspaceFlowTree | null>;
  upsertModel(model: Partial<WorkspaceFlowTree>, options: Options): Promise<unknown>;
  attach(
    uid: string,
    parent: { parentId: string; subKey: string; subType: 'object' },
    options: Options,
  ): Promise<unknown>;
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await this.db.sequelize.transaction(async (transaction) => {
      const models = this.db.getRepository('flowModels') as unknown as Models;
      const options: Options = { transaction, includeAsyncNode: true };
      for (const uid of ['lcwsrunformgrid', 'lcwscreaterungrid']) {
        const grid = await models.findModelById(uid, options);
        if (grid) await this.addRunDocuments(models, grid, options);
      }
      const oldTab = await models.findModelById('lcwsshiptab', options);
      if (oldTab?.subKey === 'tabs' && oldTab.parentId === 'lcwsrecordpage') {
        // The overview still loads the tab's saved association selector by UID.
        await models.attach(
          oldTab.uid,
          { parentId: oldTab.parentId, subKey: 'retiredShipmentTab', subType: 'object' },
          options,
        );
      }
    });
  }

  private async addRunDocuments(models: Models, grid: WorkspaceFlowTree, options: Options): Promise<void> {
    const uid = `${grid.uid}documents`;
    const settings = grid.stepParams?.gridSettings as
      | {
          grid?: {
            rows?: Record<string, string[][]>;
            layout?: { rows?: Array<{ id: string; cells: Array<{ items?: string[] }> }> };
          };
        }
      | undefined;
    const layout = settings?.grid;
    const details = layout?.rows?.details;
    if (!layout || !details?.[0]) throw new Error('В общей форме не найдена колонка полей рейса.');
    if (details[0].includes(uid)) return;

    const layoutCells = layout.layout?.rows?.find((row) => row.id === 'details')?.cells;
    if (layoutCells?.[0]?.items && !layoutCells[0].items.includes(uid)) layoutCells[0].items.push(uid);
    await models.upsertModel(
      {
        uid,
        use: 'LogisticsWorkspaceRunDocumentsModel',
        parentId: grid.uid,
        subKey: 'items',
        subType: 'array',
        subModels: {
          files: {
            uid: `${uid}files`,
            use: 'CompanyFilesBlockModel',
            async: true,
            parentId: uid,
            subKey: 'files',
            subType: 'object',
            decoratorProps: { title: 'Документы рейса' },
            props: { source: 'auto', openInWindow: false },
          },
        },
      },
      options,
    );
    await models.upsertModel(
      {
        uid: grid.uid,
        stepParams: {
          ...grid.stepParams,
          gridSettings: {
            ...settings,
            grid: {
              ...layout,
              rows: { ...layout.rows, details: [[...details[0], uid], ...details.slice(1)] },
            },
          },
        },
      },
      options,
    );
  }
}
