/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { autorun } from '@formily/reactive';
import { FlowEngine, FlowModel } from '@nocobase/flow-engine';
import type { ModelConstructor } from '@nocobase/flow-engine';
import {
  TableColumnModel,
  TableActionsColumnModel,
  JSColumnModel,
  SubTableColumnModel,
  PopupSubTableActionsColumnModel,
} from '@nocobase/client';
import type { TableColumnProps } from 'antd';
import { describe, expect, it, vi } from 'vitest';
import type { TablePersonalization } from '../../../../../shared/contracts';
import { RESIZABLE_TABLE_MODELS } from '../../../../../shared/contracts';
import {
  getWidthController,
  setPersonalColumnUid,
  tableIdentity,
  tableOwner,
  withColumnWidth,
} from '../columnWidthBinding';
import { ColumnWidthHeader } from '../../ui/ColumnWidthHeader';

const classes = {
  TableColumnModel,
  TableActionsColumnModel,
  JSColumnModel,
  SubTableColumnModel,
  PopupSubTableActionsColumnModel,
};

function fixture(use: string, columnUse: keyof typeof classes = 'TableColumnModel') {
  const engine = new FlowEngine();
  let designer = false;
  const data: TablePersonalization = {
    schemaSignature: 'a'.repeat(64),
    columns: [],
    resizableColumnUids: ['column'],
    settings: { version: 1, columnOrder: [], hiddenColumnUids: [], columnWidths: { column: 260 } },
  };
  engine.context.defineProperty('api', {
    value: { request: vi.fn().mockResolvedValue({ data: { data } }), auth: { role: 'reader' } },
  });
  engine.context.defineProperty('user', { value: { id: 'one' } });
  engine.context.defineProperty('acl', { value: { data: {} } });
  engine.context.defineProperty('flowSettingsEnabled', { get: () => designer, cache: false });
  const parent = new FlowModel({ uid: 'table', use, flowEngine: engine });
  engine.registerModels({ [columnUse]: withColumnWidth(classes[columnUse] as unknown as ModelConstructor) });
  const model = engine.createModel({
    uid: 'column',
    use: columnUse,
    props: { width: 150, title: 'Первый', dataIndex: 'name' },
  });
  model.setParent(parent);
  const render = vi.fn(() => 'Штатная ячейка');
  vi.spyOn(model, 'render').mockReturnValue(render);
  const controller = getWidthController(parent);
  const props = () => Reflect.apply(Reflect.get(model, 'getColumnProps'), model, [parent]) as TableColumnProps;
  return {
    model,
    parent,
    controller,
    props,
    setDesigner: (value: boolean) => {
      designer = value;
    },
  };
}

describe('native FlowEngine column width projection', () => {
  it('updates an observed projection without triggering repeated renders or changing master defaults', async () => {
    const { model, parent, controller, props } = fixture('TableBlockModel');
    const widths: unknown[] = [];
    const dispose = autorun(() => widths.push(props().width));
    try {
      expect(widths.at(-1)).toBe(150);
      await controller.activate(tableIdentity(parent), tableOwner(parent));
      expect(widths.at(-1)).toBe(260);
      controller.previewWidth('column', 360);
      expect(widths.at(-1)).toBe(360);
      expect(widths.length).toBeLessThan(8);
      model.setProps('width', 180);
      expect(props().width).toBe(360);
      controller.stop();
      expect(props().width).toBe(180);
    } finally {
      dispose();
    }
  });
  it.each(RESIZABLE_TABLE_MODELS)(
    'applies width within %s without changing the serialized model or UID',
    async (use) => {
      const { model, parent, controller, props } = fixture(use);
      const before = model.serialize();
      await controller.activate(tableIdentity(parent), tableOwner(parent));
      const result = props();
      expect(result.width).toBe(260);
      expect(result.onCell?.({}, 0)).toMatchObject({ width: 244 });
      expect(React.isValidElement(result.title) && result.title.type).toBe(ColumnWidthHeader);
      expect(model.props.width).toBe(150);
      expect(model.uid).toBe('column');
      expect(model.serialize()).toEqual(before);
      controller.previewWidth('column', 320);
      expect(props().width).toBe(320);
      expect(props().onCell?.({}, 0)).toMatchObject({ width: 304 });
      controller.stop();
      expect(props().width).toBe(150);
    },
  );

  it.each(Object.keys(classes) as (keyof typeof classes)[])(
    'retains native %s metadata, header/cell calculations and class identity',
    async (use) => {
      const { model, parent, controller, props } = fixture(
        use === 'SubTableColumnModel'
          ? 'SubTableFieldModel'
          : use === 'PopupSubTableActionsColumnModel'
            ? 'PopupSubTableFieldModel'
            : 'TableBlockModel',
        use,
      );
      expect(model).toBeInstanceOf(classes[use]);
      expect(model.constructor.name).toBe(use);
      expect(Reflect.get(model.constructor, 'meta')).toEqual(classes[use].meta);
      await controller.activate(tableIdentity(parent), tableOwner(parent));
      expect(props().width).toBe(260);
      if (use === 'SubTableColumnModel') expect(props().onCell?.({}, 0)).toMatchObject({ width: 260 });
      expect(model.props.width).toBe(150);
    },
  );

  it('delegates designer, forbidden and unsupported contexts and resolves collection UID aliases', async () => {
    const { model, parent, controller, props, setDesigner } = fixture('TableBlockModel');
    await controller.activate(tableIdentity(parent), tableOwner(parent));
    setDesigner(true);
    expect(props().width).toBe(150);
    const nativeTitle = props().title;
    expect(React.isValidElement(nativeTitle) && nativeTitle.type).not.toBe(ColumnWidthHeader);
    setDesigner(false);
    Reflect.set(model, 'forbidden', true);
    expect(props().width).toBe(150);
    Reflect.set(model, 'forbidden', false);
    setPersonalColumnUid(model, 'logical-extra');
    controller.previewWidth('logical-extra', 420);
    expect(props().width).toBe(420);
    model.setParent(new FlowModel({ uid: 'other', use: 'DetailsBlockModel', flowEngine: model.flowEngine }));
    expect(props().width).toBe(150);
  });
});
