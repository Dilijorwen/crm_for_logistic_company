/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createMockDatabase, type Database } from '@nocobase/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOGISTICS_STATUS_OPTIONS } from '../../../shared/logistics';
import UpdateStatusPresentation from '../20261109020000-update-logistics-status-presentation';

const run = process.env.DB_DIALECT === 'postgres' && process.env.DB_DATABASE === 'logistics_palette_test';

describe.runIf(run)('logistics status presentation upgrade', () => {
  let db: Database;

  beforeAll(async () => {
    db = await createMockDatabase();
    db.collection({
      name: 'fields',
      fields: [
        { type: 'string', name: 'collectionName' },
        { type: 'string', name: 'name' },
        { type: 'json', name: 'options' },
      ],
    });
    db.collection({
      name: 'flowModels',
      autoGenId: false,
      fields: [
        { type: 'string', name: 'uid', primaryKey: true },
        { type: 'json', name: 'options' },
      ],
    });
    db.collection({
      name: 'lc_table_filter_templates',
      fields: [
        { type: 'bigInt', name: 'userId' },
        { type: 'string', name: 'instanceKey' },
        { type: 'string', name: 'tableUid' },
        { type: 'string', name: 'name' },
        { type: 'json', name: 'filter' },
        { type: 'integer', name: 'revision' },
      ],
      indexes: [{ fields: ['userId', 'instanceKey', 'name'], unique: true }],
    });
    db.collection({
      name: 'lc_table_template_initializations',
      fields: [
        { type: 'bigInt', name: 'userId' },
        { type: 'string', name: 'instanceKey' },
      ],
    });
    await db.sync();
  });

  afterAll(async () => {
    if (!db) return;
    await db.clean({ drop: true });
    await db.close();
  });

  it('updates the stock enum and saved column, renaming matching presets once while retaining user choices', async () => {
    const fields = db.getRepository('fields');
    const flowModels = db.getRepository('flowModels');
    const templates = db.getRepository('lc_table_filter_templates');
    const initializations = db.getRepository('lc_table_template_initializations');
    const oldOption = { value: 'in_russia', label: 'В России', icon: 'EnvironmentOutlined' };
    const oldSchema = { title: 'Мой статус', 'x-component': 'Select', enum: [oldOption] };
    for (const collectionName of ['shipments', 'logistics_work_items', 'permit_documents']) {
      await fields.create({ values: { collectionName, name: 'status', options: { uiSchema: oldSchema } } });
      await flowModels.create({
        values: {
          uid: collectionName,
          options: { stepParams: { resourceSettings: { init: { collectionName } } } },
        },
      });
    }
    await flowModels.create({
      values: { uid: 'lclogworkfield8', options: { props: { options: [oldOption], className: 'status' } } },
    });
    const statusFilter = { logic: '$and', items: [{ path: 'status', operator: '$eq', value: 'in_russia' }] };
    async function createTemplate(userId: number, tableUid: string, name: string, filter = statusFilter) {
      return templates.create({ values: { userId, tableUid, instanceKey: tableUid, name, filter, revision: 1 } });
    }
    await initializations.create({
      values: [
        { userId: 1, instanceKey: 'logistics_work_items' },
        { userId: 2, instanceKey: 'shipments' },
        { userId: 3, instanceKey: 'permit_documents' },
        { userId: 5, instanceKey: 'shipments' },
      ],
    });
    const initial = await createTemplate(1, 'logistics_work_items', 'В России');
    const collision = await createTemplate(2, 'shipments', 'В России');
    const custom = await createTemplate(2, 'shipments', 'РФ', { logic: '$and', items: [] });
    const otherTable = await createTemplate(3, 'permit_documents', 'В России');
    const manual = await createTemplate(4, 'shipments', 'В России');
    const renamed = await createTemplate(5, 'shipments', 'Мои поставки');
    const edited = await createTemplate(5, 'shipments', 'В России', { logic: '$and', items: [] });

    const migration = new UpdateStatusPresentation({
      db,
      queryInterface: db.sequelize.getQueryInterface(),
      sequelize: db.sequelize,
    });
    await migration.up();
    await migration.up();

    const withIcon = LOGISTICS_STATUS_OPTIONS.map((option) =>
      option.value === 'in_russia' ? { ...option, icon: oldOption.icon } : option,
    );
    for (const collectionName of ['shipments', 'logistics_work_items']) {
      const field = await fields.findOne({ filter: { collectionName, name: 'status' } });
      expect(field.get('options')).toEqual({ uiSchema: { ...oldSchema, enum: withIcon } });
    }
    expect(LOGISTICS_STATUS_OPTIONS).toContainEqual({ value: 'in_russia', label: 'РФ', color: '#0891B2' });
    expect(LOGISTICS_STATUS_OPTIONS).toContainEqual({ value: 're_export', label: 'Реэкспорт', color: '#334155' });
    const otherField = await fields.findOne({ filter: { collectionName: 'permit_documents', name: 'status' } });
    expect(otherField.get('options')).toEqual({ uiSchema: oldSchema });
    const flowField = await flowModels.findOne({ filterByTk: 'lclogworkfield8' });
    expect(flowField.get('options')).toEqual({ props: { className: 'status', options: withIcon } });
    expect((await initial.reload()).toJSON()).toMatchObject({ name: 'РФ', revision: 2, filter: statusFilter });
    for (const template of [collision, custom, otherTable, manual, renamed, edited]) {
      const before = template.toJSON();
      expect((await template.reload()).toJSON()).toEqual(before);
    }
  });
});
