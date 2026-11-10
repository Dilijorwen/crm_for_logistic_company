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
import AddPermitDocumentMarking from '../20261109010000-add-permit-document-marking';

let db: Database;
afterEach(async () => db?.close());

it('adds a nullable manual field to the existing create, edit and details layouts once', async () => {
  db = await createMockDatabase();
  await db.clean({ drop: true });
  db.registerRepositories({ FlowModelRepository });
  db.collection(flowModels);
  db.collection(flowModelTreePath);
  db.collection({ name: 'permit_documents', fields: [{ name: 'title', type: 'string' }] });
  db.collection({
    name: 'fields',
    fields: [
      { name: 'collectionName', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'type', type: 'string' },
      { name: 'interface', type: 'string' },
      { name: 'uiSchema', type: 'json' },
    ],
  });
  await db.sync();
  await db.getRepository('permit_documents').create({ values: { title: 'Исходный документ' } });

  const flow = db.getRepository<FlowModelRepository>('flowModels');
  const blocks = [
    ['create', 'CreateFormModel', 'FormGridModel', 'FormItemModel', 'TextareaFieldModel', 'FormSubmitActionModel'],
    ['edit', 'EditFormModel', 'FormGridModel', 'FormItemModel', 'TextareaFieldModel', 'FormSubmitActionModel'],
    [
      'details',
      'DetailsBlockModel',
      'DetailsGridModel',
      'DetailsItemModel',
      'DisplayTextFieldModel',
      'EditActionModel',
    ],
  ] as const;
  for (const [uid, use, gridModel, itemModel, fieldModel, actionModel] of blocks) {
    const title = `${uid}-title`;
    const row = { id: 'original', cells: [{ id: 'cell', items: [title] }], sizes: [24] };
    await flow.upsertModel({
      uid,
      use,
      stepParams: { resourceSettings: { init: { collectionName: 'permit_documents', dataSourceKey: 'main' } } },
      subModels: {
        grid: {
          uid: `${uid}-grid`,
          use: gridModel,
          stepParams: { gridSettings: { grid: { layout: { version: 2, rows: [row] } } } },
          subModels: {
            items: [
              {
                uid: title,
                use: itemModel,
                stepParams: { fieldSettings: { init: { collectionName: 'permit_documents', fieldPath: 'title' } } },
                subModels: { field: { uid: `${title}-field`, use: fieldModel } },
              },
            ],
          },
        },
        actions: [{ uid: `${uid}-action`, use: actionModel }],
      },
    });
  }
  const migration = new AddPermitDocumentMarking({ db } as unknown as ConstructorParameters<
    typeof AddPermitDocumentMarking
  >[0]);
  await migration.up();
  await migration.up();

  const [records] = await db.sequelize.query('select title, marking from permit_documents');
  expect(records).toEqual([{ title: 'Исходный документ', marking: null }]);
  const fields = await db.getRepository('fields').find();
  expect(fields.map((field) => field.toJSON())).toMatchObject([
    { name: 'marking', type: 'text', interface: 'textarea', uiSchema: { title: 'Маркировка' } },
  ]);
  for (const [uid, , , itemModel, fieldModel, actionModel] of blocks) {
    const tree = await flow.findModelById(uid);
    const grid = tree.subModels.grid;
    const [title, marking] = grid.subModels.items;
    expect(grid.subModels.items).toHaveLength(2);
    expect(title.uid).toBe(`${uid}-title`);
    expect(marking).toMatchObject({
      use: itemModel,
      stepParams: { fieldSettings: { init: { collectionName: 'permit_documents', fieldPath: 'marking' } } },
      subModels: { field: { use: fieldModel } },
    });
    expect(grid.stepParams.gridSettings.grid.layout.rows).toMatchObject([
      { id: 'original', cells: [{ items: [title.uid] }] },
      { cells: [{ items: [marking.uid] }] },
    ]);
    expect(tree.subModels.actions).toMatchObject([{ uid: `${uid}-action`, use: actionModel }]);
  }
});
