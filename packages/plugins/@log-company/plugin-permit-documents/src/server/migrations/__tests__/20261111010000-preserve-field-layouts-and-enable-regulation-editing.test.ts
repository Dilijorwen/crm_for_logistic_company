/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createMockDatabase, type Database } from '@nocobase/database';
import { afterEach, expect, it } from 'vitest';
import flowModels from '../../../../../../@nocobase/plugin-flow-engine/src/server/collections/flowModels';
import flowModelTreePath from '../../../../../../@nocobase/plugin-flow-engine/src/server/collections/flowModelTreePath';
import { FlowModelRepository } from '../../../../../../@nocobase/plugin-flow-engine/src/server/repository';
import fieldLayout from '../../infrastructure/metadata/permitDocumentFieldLayout.json';
import PreserveFieldLayoutsAndEnableRegulationEditing from '../20261111010000-preserve-field-layouts-and-enable-regulation-editing';

let db: Database;
afterEach(async () => db?.close());

it('restores captured nested grids, column order and widths without replacing actions or popup settings', async () => {
  db = await createMockDatabase();
  await db.clean({ drop: true });
  db.registerRepositories({ FlowModelRepository });
  db.collection(flowModels);
  db.collection(flowModelTreePath);
  db.collection({
    name: 'fields',
    fields: [
      { name: 'name', type: 'string' },
      { name: 'collectionName', type: 'string' },
      { name: 'options', type: 'json' },
    ],
  });
  await db.sync();
  await db.getRepository('fields').create({
    values: {
      name: 'technical_regulations',
      collectionName: 'permit_documents',
      options: {
        target: 'technical_regulations',
        uiSchema: { 'x-component-props': { multiple: true, disabled: true } },
      },
    },
  });
  const repository = db.getRepository<FlowModelRepository>('flowModels');
  const popup = { popupSettings: { openView: { mode: 'dialog', uid: 'original-view' } } };
  for (const block of fieldLayout.blocks) {
    const items = block.fields
      .slice()
      .reverse()
      .map((field) => ({
        uid: field.uid,
        use: block.grid ? 'FormItemModel' : 'TableColumnModel',
        stepParams: {
          fieldSettings: { init: { collectionName: block.collectionName, fieldPath: field.fieldPath } },
          ...popup,
          ...(block.grid ? {} : { tableColumnSettings: { width: { width: 9 } } }),
        },
      }));
    await repository.upsertModel({
      uid: block.uid,
      use: block.use,
      stepParams: { resourceSettings: { init: { collectionName: block.collectionName } }, ...popup },
      subModels: {
        ...(block.grid
          ? {
              grid: {
                uid: block.grid.uid,
                use: 'FormGridModel',
                stepParams: { gridSettings: { grid: { layout: { version: 2, rows: [] } } } },
                subModels: { items },
              },
            }
          : { columns: items }),
        actions: [{ uid: `${block.uid}-submit`, use: 'FormSubmitActionModel', stepParams: popup }],
      },
    });
  }
  // The captured create form has acquired an extra designer field since the snapshot.
  const changed = fieldLayout.blocks.find((block) => block.use === 'CreateFormModel');
  await repository.upsertModel({
    uid: 'extra',
    use: 'FormItemModel',
    parentId: changed.grid.uid,
    subKey: 'items',
    subType: 'array',
    stepParams: { fieldSettings: { init: { fieldPath: 'extra' } } },
  });
  const migration = new PreserveFieldLayoutsAndEnableRegulationEditing({ db } as unknown as ConstructorParameters<
    typeof PreserveFieldLayoutsAndEnableRegulationEditing
  >[0]);
  await migration.up();
  const first = (await repository.find({ sort: ['uid'] })).map((model) => model.toJSON());
  await migration.up();
  expect((await repository.find({ sort: ['uid'] })).map((model) => model.toJSON())).toEqual(first);
  for (const block of fieldLayout.blocks) {
    const tree = await repository.findModelById(block.uid);
    expect(tree.stepParams.popupSettings).toEqual(popup.popupSettings);
    expect(tree.subModels.actions).toMatchObject([{ uid: `${block.uid}-submit`, stepParams: popup }]);
    if (block.uid === changed.uid) {
      expect(tree.subModels.grid.stepParams.gridSettings.grid.layout.rows).toEqual([]);
      continue;
    }
    const items = block.grid ? tree.subModels.grid.subModels.items : tree.subModels.columns;
    expect(items.map((item: { uid: string }) => item.uid)).toEqual(block.fields.map((field) => field.uid));
    for (const item of items) {
      expect(item.stepParams.popupSettings).toEqual(popup.popupSettings);
      if (!block.grid)
        expect(item.stepParams.tableColumnSettings).toEqual(
          block.fields.find((field) => field.uid === item.uid).columnSettings,
        );
    }
    if (block.grid) expect(tree.subModels.grid.stepParams.gridSettings.grid).toEqual(block.grid.settings ?? {});
  }
  const field = await db.getRepository('fields').findOne({ filter: { name: 'technical_regulations' } });
  expect(field.get('options')).toMatchObject({
    target: 'technical_regulations',
    uiSchema: { 'x-component-props': { multiple: true, disabled: false } },
  });
});
