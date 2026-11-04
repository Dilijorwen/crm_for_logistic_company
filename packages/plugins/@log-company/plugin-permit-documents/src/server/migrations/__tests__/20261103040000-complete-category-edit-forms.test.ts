/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createMockDatabase, type Database } from '@nocobase/database';
import { FlowModelRepository } from '../../../../../../@nocobase/plugin-flow-engine/src/server/repository';
import flowModels from '../../../../../../@nocobase/plugin-flow-engine/src/server/collections/flowModels';
import flowModelTreePath from '../../../../../../@nocobase/plugin-flow-engine/src/server/collections/flowModelTreePath';
import { afterEach, describe, expect, it } from 'vitest';
import { ensurePermitDocumentEditFields } from '../../infrastructure/metadata/EnsurePermitDocumentEditFields';

describe('category edit form migration', () => {
  let db: Database;
  afterEach(async () => db?.close());
  it.each(['automatic', 'legacy', 'v2'])(
    'appends missing fields to %s layout while preserving existing models and transitions, idempotently',
    async (layoutKind) => {
      db = await createMockDatabase();
      await db.clean({ drop: true });
      db.registerRepositories({ FlowModelRepository });
      db.collection(flowModels);
      db.collection(flowModelTreePath);
      await db.sync();
      const repository = db.getRepository<FlowModelRepository>('flowModels');
      const originalRow = { id: 'original', cells: [{ id: 'cell', items: ['number'] }], sizes: [24] };
      const grid =
        layoutKind === 'v2'
          ? { layout: { version: 2, rows: [originalRow] } }
          : layoutKind === 'legacy'
            ? { rows: { original: [['number']] }, sizes: { original: [24] } }
            : {};
      const form = {
        uid: 'edit',
        use: 'EditFormModel',
        stepParams: {
          resourceSettings: {
            init: {
              collectionName: 'permit_documents',
              dataSourceKey: 'main',
              filterByTk: '{{ctx.view.inputArgs.filterByTk}}',
            },
          },
        },
        subModels: {
          grid: {
            uid: 'grid',
            use: 'FormGridModel',
            stepParams: { gridSettings: { grid } },
            subModels: {
              items: [
                {
                  uid: 'number',
                  use: 'FormItemModel',
                  stepParams: { fieldSettings: { init: { fieldPath: 'title', collectionName: 'permit_documents' } } },
                  subModels: { field: { uid: 'number-input', use: 'InputFieldModel' } },
                },
              ],
            },
          },
          actions: [{ uid: 'submit', use: 'FormSubmitActionModel' }],
        },
      };
      await repository.upsertModel(form);
      await repository.upsertModel({
        uid: 'other-form',
        use: 'EditFormModel',
        stepParams: { resourceSettings: { init: { collectionName: 'our_companies' } } },
        subModels: { grid: { uid: 'other-grid', use: 'FormGridModel' } },
      });
      await repository.upsertModel({
        uid: 'details',
        use: 'DetailsBlockModel',
        stepParams: { resourceSettings: { init: { collectionName: 'permit_documents' } } },
      });
      await repository.upsertModel({
        uid: 'link',
        use: 'DisplayTextFieldModel',
        stepParams: { popupSettings: { openView: { uid: 'details', mode: 'dialog' } } },
      });
      const original = await repository.find({ sort: ['uid'] });
      const snapshots = original.filter((model) => model.get('uid') !== 'grid').map((model) => model.toJSON());
      await db.sequelize.transaction((transaction) => ensurePermitDocumentEditFields(db, transaction));
      const first = (await repository.find({ sort: ['uid'] })).map((model) => model.toJSON());
      for (const snapshot of snapshots) expect(first).toContainEqual(snapshot);
      const tree = await repository.findModelById('edit');
      expect(tree.subModels.grid.subModels.items[0].uid).toBe('number');
      expect(
        tree.subModels.grid.subModels.items.map(
          (item: { stepParams: { fieldSettings: { init: { fieldPath: string } } } }) =>
            item.stepParams.fieldSettings.init.fieldPath,
        ),
      ).toContain('rental_until');
      const resultGrid = tree.subModels.grid.stepParams.gridSettings.grid;
      if (layoutKind === 'v2') expect(resultGrid.layout.rows[0]).toEqual(originalRow);
      if (layoutKind === 'legacy') expect(resultGrid.rows.original).toEqual([['number']]);
      await db.sequelize.transaction((transaction) => ensurePermitDocumentEditFields(db, transaction));
      expect((await repository.find({ sort: ['uid'] })).map((model) => model.toJSON())).toEqual(first);
    },
  );
});
