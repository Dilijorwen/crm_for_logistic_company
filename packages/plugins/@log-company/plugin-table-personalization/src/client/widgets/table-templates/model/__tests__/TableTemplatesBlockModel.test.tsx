/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { Space } from 'antd';
import { FilterActionModel, TableColumnModel } from '@nocobase/client';
import { FlowEngine, MultiRecordResource } from '@nocobase/flow-engine';
import { describe, expect, it, vi } from 'vitest';
import { TableTemplatesBlockModel } from '../TableTemplatesBlockModel';
import { TableTemplatesButton } from '../../../../features/filter-templates';
import { ColumnSettingsButton } from '../../../../features/table-personalization/ui/ColumnSettingsButton';
import type { TablePersonalization } from '../../../../../shared/contracts';
import type { FilterTemplate } from '../../../../../shared/filterTemplates';
import { emptyFilter } from '../../../../../shared/filterTemplates';

function elements(node: React.ReactNode): React.ReactElement<{ children?: React.ReactNode }>[] {
  return React.Children.toArray(node).flatMap((child) =>
    React.isValidElement<{ children?: React.ReactNode }>(child) ? [child, ...elements(child.props.children)] : [],
  );
}

function fixture(withFilter = true) {
  const engine = new FlowEngine();
  const data: TablePersonalization = {
    schemaSignature: 'a'.repeat(64),
    columns: ['first', 'second'].map((uid) => ({ uid, title: uid, fieldPath: uid, fixed: 'normal' })),
    settings: {
      version: 1,
      columnOrder: ['second', 'first'],
      hiddenColumnUids: ['first'],
      columnWidths: { second: 330 },
    },
  };
  const request = vi.fn().mockResolvedValue({ data: { data } });
  engine.context.defineProperty('api', { value: { request, auth: { role: 'root' } } });
  engine.context.defineProperty('user', { value: { id: 'user' } });
  engine.context.defineProperty('acl', { value: { data: {} } });
  const table = new TableTemplatesBlockModel({ uid: 'table', use: 'TableBlockModel', flowEngine: engine });
  table.context.defineProperty('themeToken', { value: { margin: 16, marginXXS: 4, controlHeight: 32 } });
  const resource = new MultiRecordResource(table.context);
  table.context.defineProperty('resource', { value: resource });
  const refresh = vi.spyOn(resource, 'refresh').mockResolvedValue(undefined);
  table.subModels.columns = ['first', 'second'].map((uid) => {
    const column = new TableColumnModel({ uid, use: 'TableColumnModel', flowEngine: engine, props: { width: 120 } });
    vi.spyOn(column, 'getColumnProps').mockReturnValue({ key: uid, width: 120 });
    return column;
  });
  const filter = new FilterActionModel({
    uid: 'filter',
    use: 'FilterActionModel',
    flowEngine: engine,
    props: { position: 'left' },
  });
  filter.context.defineProperty('blockModel', { value: table });
  const submit = vi.spyOn(filter, 'dispatchEvent').mockResolvedValue([]);
  table.subModels.actions = withFilter ? [filter] : [];
  return { table, resource, filter, submit, request, data, refresh };
}

const template: FilterTemplate = {
  id: 'template',
  name: 'Мой вид',
  revision: 1,
  filter: { logic: '$and', items: [{ path: 'first', operator: '$eq', value: 'test' }] },
  columnSettings: {
    version: 1,
    columnOrder: ['second', 'first'],
    hiddenColumnUids: ['first'],
    columnWidths: { second: 250 },
  },
};

describe('table templates and column personalization integration', () => {
  it.each([true, false])('applies operators without a stored value (native filter button=%s)', async (withFilter) => {
    const { table, filter, resource } = fixture(withFilter);
    vi.spyOn(table.personalization, 'restore').mockResolvedValue(true);
    const saved: FilterTemplate = {
      ...template,
      filter: { logic: '$and', items: [{ path: 'first', operator: '$isTruly', noValue: true }] },
    };
    await table.applyTableTemplate(saved);
    if (withFilter) expect(filter.props.filterValue.items[0]).toMatchObject({ noValue: true, value: true });
    else expect(resource.getFilter()).toEqual({ $and: [{ $and: [{ first: { $isTruly: true } }] }] });
    expect(saved.filter.items[0]).not.toHaveProperty('value');
  });
  it('places the labeled templates button after columns in the native toolbar without changing the schema', () => {
    const { table } = fixture();
    Reflect.set(table, 'columns', { value: table.getColumns() });
    const before = table.serialize();
    const spaces = elements(table.renderComponent()).filter((element) => element.type === Space);
    const left = elements(spaces[0].props.children);
    expect(left.slice(0, 2).map((element) => element.type)).toEqual([ColumnSettingsButton, TableTemplatesButton]);
    expect(table.serialize()).toEqual(before);
  });

  it('captures the current filter, selected/hidden columns, order and effective widths', async () => {
    const { table, filter } = fixture();
    filter.setProps('filterValue', template.filter);
    const snapshot = await table.captureTemplateSnapshot();
    expect(snapshot).toEqual({
      filter: template.filter,
      columnSettings: {
        version: 1,
        columnOrder: ['second', 'first'],
        hiddenColumnUids: ['first'],
        columnWidths: { second: 330, first: 120 },
      },
    });
    expect(snapshot.filter).not.toBe(template.filter);
  });

  it('restores columns before applying the native filter and does not mutate the stored snapshot', async () => {
    const { table, filter, submit } = fixture();
    const restore = vi.spyOn(table.personalization, 'restore').mockResolvedValue(true);
    expect(await table.applyTableTemplate(template)).toBe(true);
    expect(restore).toHaveBeenCalledWith(template.columnSettings);
    expect(submit).toHaveBeenCalledWith('submit');
    expect(filter.props.filterValue).toEqual(template.filter);
    filter.props.filterValue.items[0].value = 'edited';
    expect(template.filter.items[0]).toMatchObject({ value: 'test' });
  });

  it('clears the filter and restores the shared layout for no template', async () => {
    const { table, filter } = fixture();
    const reset = vi.spyOn(table.personalization, 'reset').mockResolvedValue(true);
    await table.applyTableTemplate();
    expect(reset).toHaveBeenCalledOnce();
    expect(filter.props.filterValue).toEqual(emptyFilter());
  });

  it('does not change the filter when restoring columns fails', async () => {
    const { table, submit } = fixture();
    vi.spyOn(table.personalization, 'restore').mockResolvedValue(false);
    await expect(table.applyTableTemplate(template)).rejects.toThrow('Не удалось');
    expect(submit).not.toHaveBeenCalled();
  });

  it('supports a table without a filter button while preserving unrelated filter groups', async () => {
    const { table, resource, refresh } = fixture(false);
    vi.spyOn(table.personalization, 'restore').mockResolvedValue(true);
    vi.spyOn(table.personalization, 'reset').mockResolvedValue(true);
    resource.addFilterGroup('dataScope', { tenantId: { $eq: 7 } });
    await table.applyTableTemplate(template);
    expect(resource.getFilter()).toEqual({ $and: [{ tenantId: { $eq: 7 } }, { $and: [{ first: { $eq: 'test' } }] }] });
    await table.applyTableTemplate();
    expect(resource.getFilter()).toEqual({ $and: [{ tenantId: { $eq: 7 } }] });
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
