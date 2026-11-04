/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import {
  Application,
  DisplayNumberFieldModel,
  DisplayEnumFieldModel,
  DisplayDateTimeFieldModel,
  DisplayTextFieldModel,
  DisplayCheckboxFieldModel,
  numberFormat,
  dateTimeFormat,
} from '@nocobase/client';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

function setup(field: { name: string; type: string; interface: string; uiSchema: Record<string, unknown> }) {
  const engine = new Application().flowEngine;
  engine.registerActions({ numberFormat, dateTimeFormat });
  const source = engine.context.dataSourceManager.getDataSource('main');
  source?.addCollection({ name: 'test-fields', fields: [field] });
  return { engine, collectionField: source?.getCollection('test-fields')?.getField(field.name) };
}

describe('workspace values use native NocoBase display components', () => {
  it.each([
    [53.12, '0.01', '53.12'],
    [0.01, '0.01', '0.01'],
    [0, '0.01', '0.00'],
    [9876.5432, '0.0001', '9,876.5432'],
    ['123.4567', '0.0001', '123.4567'],
  ])('retains native configured precision for %s', async (value, step, expected) => {
    const { engine, collectionField } = setup({
      name: 'amount',
      type: 'double',
      interface: 'number',
      uiSchema: { 'x-component-props': { step, stringMode: true, decimalSeparator: ',' } },
    });
    const model = engine.createModel({ use: DisplayNumberFieldModel });
    model.context.defineProperty('collectionField', { value: collectionField });
    await model.applyFlow('numberSettings');
    const rendered = render(model.renderComponent(value));
    expect(rendered.container.textContent).toBe(expected);
  });

  it.each([
    ['operator', 'Оператор'],
    ['els', 'ЕЛС'],
    ['unknown', 'unknown'],
    [null, ''],
    [['els', 'operator'], 'ЕЛСОператор'],
    [[], ''],
  ])('renders configured labels, arrays, unknown and empty values (%s)', (value, expected) => {
    const { engine, collectionField } = setup({
      name: 'scheme',
      type: 'string',
      interface: 'select',
      uiSchema: {
        enum: [
          { value: 'operator', label: 'Оператор' },
          { value: 'els', label: 'ЕЛС' },
        ],
      },
    });
    const model = engine.createModel({ use: DisplayEnumFieldModel, props: collectionField?.getComponentProps() });
    const rendered = render(model.renderInDisplayStyle(value));
    expect(rendered.container.textContent).toBe(expected);
  });

  it('keeps standard date, boolean and escaped text rendering', async () => {
    const { engine, collectionField } = setup({
      name: 'date',
      type: 'dateOnly',
      interface: 'date',
      uiSchema: { 'x-component-props': { dateOnly: true, dateFormat: 'DD.MM.YYYY' } },
    });
    const date = engine.createModel({ use: DisplayDateTimeFieldModel });
    date.context.defineProperty('collectionField', { value: collectionField });
    await date.applyFlow('datetimeSettings');
    expect(render(date.renderComponent('2026-11-03')).container.textContent).toBe('03.11.2026');
    const text = engine.createModel({ use: DisplayTextFieldModel });
    expect(
      render(text.renderComponent('<script>literal</script>', false)).container.querySelector('script'),
    ).toBeNull();
    const checkbox = engine.createModel({ use: DisplayCheckboxFieldModel, props: { value: false } });
    expect(render(checkbox.render()).getByRole('checkbox')).not.toBeChecked();
  });
});
