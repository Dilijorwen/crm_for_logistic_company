/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import '@testing-library/jest-dom/vitest';
import { FlowEngine, DataSourceManager } from '@nocobase/flow-engine';
import type { ModelConstructor } from '@nocobase/flow-engine';
import {
  TableColumnModel,
  DisplayTextFieldModel,
  DisplayJSONFieldModel,
  aclCheck,
  fixed,
  titleField,
  displayFieldComponent,
  overflowMode,
} from '@nocobase/client';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PersonalizableColumn, TablePersonalization } from '../../../../../shared/contracts';
import { PersonalizedTableBlockModel } from '../PersonalizedTableBlockModel';

const extra: PersonalizableColumn = {
  uid: 'extra',
  title: 'Дополнительное поле',
  fieldPath: 'extra',
  fixed: 'normal',
  source: 'collection',
};
const relation: PersonalizableColumn = {
  uid: 'relation',
  title: 'Отдел',
  fieldPath: 'department',
  fixed: 'normal',
  source: 'collection',
};
function fixture() {
  const engine = new FlowEngine();
  engine.registerModels({
    TableBlockModel: PersonalizedTableBlockModel,
    TableColumnModel: TableColumnModel as unknown as ModelConstructor,
    DisplayTextFieldModel,
    DisplayJSONFieldModel,
  });
  engine.registerActions({ aclCheck, fixed, titleField, displayFieldComponent, overflowMode });
  const manager = new DataSourceManager();
  manager.setFlowEngine(engine);
  manager.addDataSource({ key: 'main' });
  const source = manager.getDataSource('main');
  if (!source) throw new Error('Invalid test data source');
  source.addCollection({
    name: 'departments',
    filterTargetKey: 'id',
    titleField: 'name',
    fields: [{ name: 'name', type: 'string', interface: 'input', uiSchema: { title: 'Название' } }],
  });
  source.addCollection({
    name: 'records',
    filterTargetKey: 'id',
    fields: [
      { name: 'id', type: 'integer', interface: 'integer' },
      { name: 'extra', type: 'string', interface: 'input', uiSchema: { title: extra.title } },
      { name: 'department', type: 'belongsTo', target: 'departments', interface: 'm2o', uiSchema: { title: 'Отдел' } },
    ],
  });
  let data: TablePersonalization = { schemaSignature: 'a'.repeat(64), columns: [extra, relation], settings: null };
  const request = vi.fn().mockImplementation(async () => ({ data: { data } }));
  engine.context.defineProperty('dataSourceManager', { value: manager });
  engine.context.defineProperty('api', { value: { request, auth: { role: 'reader' } } });
  engine.context.defineProperty('user', { value: { id: 'user' } });
  engine.context.defineProperty('acl', { value: { data: {} } });
  engine.context.defineProperty('flowSettingsEnabled', { value: false });
  engine.context.defineProperty('location', { value: { search: '' } });
  engine.context.defineMethod('aclCheck', vi.fn().mockResolvedValue(true));
  const created = engine.createModel({
    use: 'TableBlockModel',
    uid: 'table',
    stepParams: { resourceSettings: { init: { dataSourceKey: 'main', collectionName: 'records' } } },
  });
  if (!(created instanceof PersonalizedTableBlockModel)) throw new Error('Invalid test fixture');
  const table = created;
  const refresh = vi.spyOn(table.resource, 'refresh').mockResolvedValue(undefined);
  const activate = () =>
    table.personalization.activate(table.getPersonalizationIdentity(), table.getPersonalizationOwner());
  const select = async (uids: string[]) => {
    data = {
      ...data,
      settings: {
        version: 1,
        columnOrder: ['extra', 'relation'],
        hiddenColumnUids: ['extra', 'relation'].filter((uid) => !uids.includes(uid)),
      },
    };
    return table.personalization.save({
      version: 1,
      columnOrder: ['extra', 'relation'],
      hiddenColumnUids: ['extra', 'relation'].filter((uid) => !uids.includes(uid)),
    });
  };
  return {
    table,
    engine,
    refresh,
    request,
    activate,
    select,
    reset: async () => {
      data = { ...data, settings: null };
      return table.personalization.reset();
    },
  };
}

describe('runtime collection columns', () => {
  it('offers all descriptors without adding any field until selected, and preserves serialized configuration', async () => {
    const { table, activate, select, reset } = fixture();
    const before = table.serialize();
    await activate();
    expect(table.getPersonalizableColumns()).toEqual([extra, relation]);
    expect(table.getColumns().map((column) => column.key)).toEqual(['empty']);
    expect(await select(['extra'])).toBe(true);
    expect(table.getColumns().map((column) => column.key)).toEqual(['extra', 'empty']);
    const cell = table.getColumns()[0].onCell({ id: 1, extra: 'Реальное значение' }, 0);
    expect(cell.model.subModels.field.use).toBe('DisplayTextFieldModel');
    cell.model.subModels.field.setProps({ value: 'Реальное значение' });
    render(<>{cell.model.subModels.field.render()}</>);
    expect(screen.getByText('Реальное значение')).toBeInTheDocument();
    expect(table.serialize()).toEqual(before);
    expect(await reset()).toBe(true);
    expect(table.getColumns().map((column) => column.key)).toEqual(['empty']);
    expect(table.serialize()).toEqual(before);
  });

  it('loads selected relations through the existing resource and removes only personal appends on reset', async () => {
    const { table, activate, select, reset, refresh } = fixture();
    table.resource.addAppends('shared');
    table.resource.setFields(['id']);
    table.resource.addFilterGroup('business', { id: { $gt: 0 } });
    const filter = table.resource.getFilter();
    await activate();
    expect(await select(['relation'])).toBe(true);
    expect(table.resource.getAppends()).toEqual(['shared', 'department']);
    expect(table.resource.getFields()).toEqual(['id', 'department']);
    const cell = table.getColumns()[0].onCell({ id: 1 }, 0);
    cell.model.subModels.field.setProps({ value: { id: 10, name: 'Доступный отдел' } });
    render(<>{cell.model.subModels.field.render()}</>);
    expect(screen.getByText('Доступный отдел')).toBeInTheDocument();
    expect(cell.model.subModels.field.props.clickToOpen).toBe(false);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(table.resource.getFilter()).toEqual(filter);
    expect(await reset()).toBe(true);
    expect(table.resource.getAppends()).toEqual(['shared']);
    expect(table.resource.getFields()).toEqual(['id']);
    expect(table.resource.getFilter()).toEqual(filter);
  });

  it('removes runtime field models and request additions on owner change', async () => {
    const { table, engine, activate, select } = fixture();
    await activate();
    await select(['relation']);
    const cell = table.getColumns()[0].onCell({ id: 1 }, 0);
    const uid: string = cell.model.uid;
    table.personalization.stop();
    expect(engine.getModel(uid)).toBeUndefined();
    expect(table.resource.getAppends()).toEqual([]);
    expect(table.getColumns().map((column) => column.key)).toEqual(['empty']);
  });

  it('keeps the dialog retryable and restores request parameters after a data refresh failure', async () => {
    const { table, activate, select, refresh } = fixture();
    await activate();
    table.resource.setFields(['id']);
    refresh.mockRejectedValueOnce(new Error('Network unavailable'));
    expect(await select(['relation'])).toBe(false);
    expect(table.personalization.state.error).toContain('сохранить');
    expect(table.resource.getAppends()).toEqual([]);
    expect(table.resource.getFields()).toEqual(['id']);
    expect(await select(['relation'])).toBe(true);
    expect(table.getColumns().some((column) => column.key === 'relation')).toBe(true);
  });

  it('discards prepared models and request additions when the owner changes during refresh', async () => {
    const { table, engine, activate, select, refresh } = fixture();
    await activate();
    table.resource.setFields(['id']);
    let complete!: () => void;
    refresh.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
    );
    const saving = select(['relation']);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    table.personalization.stop();
    complete();
    expect(await saving).toBe(false);
    expect(table.resource.getFields()).toEqual(['id']);
    expect(table.resource.getAppends()).toEqual([]);
    const columns: string[] = [];
    engine.forEachModel((model) => {
      if (model instanceof TableColumnModel) columns.push(model.uid);
    });
    expect(columns).toEqual([]);
  });
});
