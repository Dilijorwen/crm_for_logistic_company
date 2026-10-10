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
import { FlowEngine, FlowModel, FlowModelRenderer, MultiRecordResource } from '@nocobase/flow-engine';
import { autorun } from '@formily/reactive';
import { ActionModel, FilterActionModel, TableBlockModel, TableColumnModel } from '@nocobase/client';
import { describe, expect, it, vi } from 'vitest';
import type { TablePersonalization } from '../../../../../shared/contracts';
import { PersonalizedTableBlockModel } from '../PersonalizedTableBlockModel';
import { ColumnSettingsButton } from '../../ui/ColumnSettingsButton';

function elements(node: React.ReactNode): React.ReactElement<{ children?: React.ReactNode; model?: FlowModel }>[] {
  return React.Children.toArray(node).flatMap((child) =>
    React.isValidElement<{ children?: React.ReactNode; model?: FlowModel }>(child)
      ? [child, ...elements(child.props.children)]
      : [],
  );
}

function fixture() {
  const engine = new FlowEngine();
  let isDesigner = false;
  const data: TablePersonalization = {
    schemaSignature: 'a'.repeat(64),
    columns: ['first', 'second'].map((uid) => ({
      uid,
      title: 'Одинаковое название',
      fieldPath: 'title',
      fixed: 'normal',
    })),
    settings: { version: 1, columnOrder: ['second', 'first'], hiddenColumnUids: ['first'] },
  };
  const request = vi.fn().mockResolvedValue({ data: { data } });
  engine.context.defineProperty('api', { value: { request, auth: { role: 'root' } } });
  engine.context.defineProperty('user', { value: { id: 'user' } });
  engine.context.defineProperty('acl', { value: { data: {} } });
  engine.context.defineProperty('flowSettingsEnabled', { get: () => isDesigner, cache: false });
  const table = new PersonalizedTableBlockModel({ uid: 'table', use: 'TableBlockModel', flowEngine: engine });
  const render = vi.fn(() => 'existing clickable renderer');
  const onCell = vi.fn(() => ({ onClick: vi.fn() }));
  const columns = ['first', 'second'].map((uid, index) => {
    const column = new TableColumnModel({
      uid,
      use: 'TableColumnModel',
      sortIndex: index,
      flowEngine: engine,
      props: { width: 120, title: 'Одинаковое название' },
    });
    vi.spyOn(column, 'getColumnProps').mockImplementation(() => ({
      width: 120,
      dataIndex: 'title',
      render,
      onCell,
      hidden: Boolean(column.hidden || column.forbidden),
    }));
    return column;
  });
  table.subModels.columns = columns;
  table.subModels.actions = [
    new ActionModel({
      uid: 'search',
      use: 'CollectionSearchActionModel',
      flowEngine: engine,
      stepParams: { collectionSearchSettings: { fields: { fieldNames: ['title', 'code'] } } },
    }),
  ];
  return {
    table,
    columns,
    data,
    request,
    render,
    onCell,
    setDesigner: (value: boolean) => {
      isDesigner = value;
    },
  };
}

describe('FlowEngine table personalization integration', () => {
  it.each([false, true])('places the icon first in the native left toolbar (filter=%s)', (withFilter) => {
    const { table } = fixture();
    table.context.defineProperty('themeToken', { value: { margin: 16, marginXXS: 4, controlHeight: 32 } });
    table.context.defineProperty('resource', { value: new MultiRecordResource(table.context) });
    Reflect.set(table, 'columns', { value: table.getColumns() });
    if (withFilter) {
      table.subModels.actions.push(
        new FilterActionModel({
          uid: 'filter',
          use: 'FilterActionModel',
          flowEngine: table.flowEngine,
          props: { position: 'left' },
        }),
      );
    }
    const before = table.serialize();
    const spaces = elements(table.renderComponent()).filter((element) => element.type === Space);
    expect(spaces).toHaveLength(2);
    const left = elements(spaces[0].props.children);
    expect(left[0].type).toBe(ColumnSettingsButton);
    expect(left.filter((element) => element.type === ColumnSettingsButton)).toHaveLength(1);
    if (withFilter) {
      expect(left[1].type).toBe(FlowModelRenderer);
      expect(left[1].props.model?.uid).toBe('filter');
    }
    const right = elements(spaces[1].props.children);
    expect(right.some((element) => element.type === ColumnSettingsButton)).toBe(false);
    expect(right.find((element) => element.type === FlowModelRenderer)?.props.model?.uid).toBe('search');
    expect(table.serialize()).toEqual(before);
  });

  it('retains the native designer toolbar and the loading placeholder', () => {
    const { table, setDesigner } = fixture();
    const nativeRender = vi.spyOn(TableBlockModel.prototype, 'renderComponent');
    try {
      expect(table.renderComponent()).toBe(nativeRender.mock.results.at(-1)?.value);
      table.context.defineProperty('themeToken', { value: { margin: 16, marginXXS: 4, controlHeight: 32 } });
      table.context.defineProperty('resource', { value: new MultiRecordResource(table.context) });
      Reflect.set(table, 'columns', { value: table.getColumns() });
      setDesigner(true);
      const rendered = table.renderComponent();
      expect(rendered).toBe(nativeRender.mock.results.at(-1)?.value);
      expect(elements(rendered).some((element) => element.type === ColumnSettingsButton)).toBe(false);
    } finally {
      nativeRender.mockRestore();
    }
  });

  it('reacts to preferences loaded after the first column projection and to reset', async () => {
    const { table, data, request } = fixture();
    const before = table.serialize();
    const projections: unknown[][] = [];
    const dispose = autorun(() => {
      projections.push(table.getColumns().map((column) => column.key));
    });
    try {
      expect(projections.at(-1)).toEqual(['first', 'second', 'empty']);
      await table.personalization.activate(table.getPersonalizationIdentity(), table.getPersonalizationOwner());
      expect(projections.at(-1)).toEqual(['second', 'empty']);
      request.mockResolvedValueOnce({ data: { data: { ...data, settings: null } } });
      await table.personalization.reset();
      expect(projections.at(-1)).toEqual(['first', 'second', 'empty']);
      expect(table.serialize()).toEqual(before);
    } finally {
      dispose();
    }
  });

  it('changes only the rendered projection and preserves click handlers, search action and serialized schema', async () => {
    const { table, columns, render, onCell } = fixture();
    const before = table.serialize();
    await table.personalization.activate(table.getPersonalizationIdentity(), table.getPersonalizationOwner());
    const projected = table.getColumns();
    expect(projected.map((column) => column.key)).toEqual(['second', 'empty']);
    expect(projected[0].render).toBe(render);
    expect(projected[0].onCell).toBe(onCell);
    expect(columns[0].hidden).toBe(false);
    expect(table.subModels.actions[0].uid).toBe('search');
    expect(table.serialize()).toEqual(before);
    expect(columns.map((column) => column.sortIndex)).toEqual([0, 1]);
  });

  it('delegates designer columns to the original implementation', async () => {
    const { table, setDesigner } = fixture();
    await table.personalization.activate(table.getPersonalizationIdentity(), table.getPersonalizationOwner());
    setDesigner(true);
    expect(table.getColumns()).toHaveLength(4);
    expect(table.getColumns().some((column) => column.key === 'addColumn')).toBe(true);
  });

  it('does not restore a forbidden column or offer it in the settings dialog', async () => {
    const { table, columns } = fixture();
    await table.personalization.activate(table.getPersonalizationIdentity(), table.getPersonalizationOwner());
    Reflect.set(columns[1], 'forbidden', true);
    expect(table.getColumns().find((column) => column.key === 'second')?.hidden).toBe(true);
    expect(table.getPersonalizableColumns().map((column) => column.uid)).toEqual(['first']);
  });

  it('distinguishes template placements while retaining the target table UID', () => {
    const { table } = fixture();
    const outer = new FlowModel({ uid: 'outer-reference', use: 'ReferenceBlockModel', flowEngine: table.flowEngine });
    const inner = new FlowModel({ uid: 'inner-reference', use: 'ReferenceBlockModel', flowEngine: table.flowEngine });
    inner.setParent(outer);
    table.setParent(inner);
    expect(table.getPersonalizationIdentity()).toEqual({
      tableUid: 'table',
      referencePath: ['outer-reference', 'inner-reference'],
    });
  });

  it('offers readable configured fields hidden by a display rule while retaining that rule in rendering', async () => {
    const { table, columns } = fixture();
    await table.personalization.activate(table.getPersonalizationIdentity(), table.getPersonalizationOwner());
    columns[1].setHidden(true);
    expect(table.getPersonalizableColumns().map((column) => column.uid)).toEqual(['first', 'second']);
    expect(table.getColumns().find((column) => column.key === 'second')?.hidden).toBe(true);
  });
});
