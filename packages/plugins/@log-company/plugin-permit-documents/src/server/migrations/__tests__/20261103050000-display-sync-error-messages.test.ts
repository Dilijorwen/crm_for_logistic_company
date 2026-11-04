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
import { afterEach, expect, it } from 'vitest';
import DisplaySyncErrorMessages from '../20261103050000-display-sync-error-messages';

let db: Database;
afterEach(async () => db?.close());

it('changes only the error renderer and preserves field identity, order and popup options on repeated migration', async () => {
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
      name: 'last_sync_error',
      collectionName: 'permit_documents',
      options: { uiSchema: { title: 'Ошибка синхронизации', 'x-component': 'Input.TextArea' } },
    },
  });
  const repository = db.getRepository<FlowModelRepository>('flowModels');
  const popup = { openView: { mode: 'dialog', uid: 'original-view' } };
  await repository.upsertModel({
    uid: 'item',
    use: 'DetailsItemModel',
    stepParams: {
      fieldSettings: { init: { collectionName: 'permit_documents', fieldPath: 'last_sync_error' } },
      detailItemSettings: { model: { use: 'DisplayTextFieldModel' }, label: { title: 'Оригинальный заголовок' } },
    },
    subModels: { field: { uid: 'input', use: 'DisplayTextFieldModel', stepParams: { popupSettings: popup } } },
  });
  await repository.upsertModel({ uid: 'other', use: 'DisplayTextFieldModel', stepParams: { popupSettings: popup } });
  const other = (await repository.findOne({ filter: { uid: 'other' } })).toJSON();
  const migration = new DisplaySyncErrorMessages({ db } as unknown as ConstructorParameters<
    typeof DisplaySyncErrorMessages
  >[0]);
  await migration.up();
  const first = (await repository.find({ sort: ['uid'] })).map((model) => model.toJSON());
  const tree = await repository.findModelById('item');
  expect(tree.stepParams.detailItemSettings.model.use).toBe('PermitDocumentSyncErrorFieldModel');
  expect(tree.stepParams.detailItemSettings.label.title).toBe('Оригинальный заголовок');
  expect(tree.subModels.field).toMatchObject({
    uid: 'input',
    use: 'PermitDocumentSyncErrorFieldModel',
    stepParams: { popupSettings: popup },
  });
  expect(first).toContainEqual(other);
  await migration.up();
  expect((await repository.find({ sort: ['uid'] })).map((model) => model.toJSON())).toEqual(first);
});
