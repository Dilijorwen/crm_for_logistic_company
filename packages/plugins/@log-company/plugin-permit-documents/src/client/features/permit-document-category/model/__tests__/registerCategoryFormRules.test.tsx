/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Application, EditFormModel, FormGridModel, FormItemModel, InputFieldModel } from '@nocobase/client';
import { Form } from 'antd';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { registerCategoryFormRules } from '../registerCategoryFormRules';

const names = [
  'title',
  'category',
  'document_type',
  'status',
  'company',
  'related_document',
  'period_from',
  'period_until',
  'technical_regulations',
  'documents',
  'rental_from',
  'rental_until',
  'valid_from',
  'valid_until',
  'product_information',
  'manufacturer_name',
  'manufacturer_address',
];

describe('native edit popup category flows', () => {
  it('inherits category rules, hides generated fields, reacts to category changes and preserves configured order', async () => {
    registerCategoryFormRules();
    const app = new Application();
    const engine = app.flowEngine;
    engine.context.defineProperty('app', { value: app });
    engine.context.dataSourceManager.getDataSource('main').addCollection({
      name: 'permit_documents',
      fields: names.map((name) => ({ name, type: 'string', interface: 'input' })),
    });
    engine.registerModels({ EditFormModel, FormGridModel, FormItemModel, InputFieldModel });
    const model = engine.createModel<EditFormModel>({
      use: 'EditFormModel',
      stepParams: {
        resourceSettings: { init: { dataSourceKey: 'main', collectionName: 'permit_documents', filterByTk: '1' } },
      },
      subModels: {
        grid: {
          use: 'FormGridModel',
          subModels: {
            items: names.map((name) => ({
              uid: name,
              use: 'FormItemModel',
              subModels: { field: { use: 'InputFieldModel' } },
            })),
          },
        },
      },
    });
    const hook = renderHook(() => Form.useForm());
    const form = hook.result.current[0];
    model.context.defineProperty('form', { value: form });
    const items = model.subModels.grid.subModels.items;
    for (const item of items)
      Object.defineProperty(item, 'collectionField', { value: model.collection.getField(item.uid) });
    const before = model.serialize();
    await act(async () => {
      form.setFieldsValue({ category: 'rented', rental_from: '2026-01-01', rental_until: '2027-01-01' });
      await model.applyFlow('permitDocumentCategory-beforeRender');
    });
    const props = (name: string) => items.find((item) => item.uid === name).props;
    expect(props('company').hidden).toBe(true);
    expect(props('rental_until')).toMatchObject({ hidden: false, required: true });
    for (const name of ['status', 'period_from', 'related_document', 'technical_regulations'])
      expect(props(name).hidden).toBe(true);
    expect(form.getFieldValue('rental_until')).toBe('2027-01-01');
    await act(async () => {
      form.setFieldValue('category', 'voluntary');
      await model.applyFlow('permitDocumentCategory-formValuesChange');
    });
    expect(props('company')).toMatchObject({ hidden: false, required: true });
    expect(props('valid_from')).toMatchObject({ hidden: false, required: true });
    expect(props('manufacturer_address')).toMatchObject({ hidden: false, required: true });
    expect(props('rental_from').hidden).toBe(true);
    expect(form.getFieldValue('document_type')).toBe('certificate_of_conformity');
    expect(model.serialize()).toEqual(before);
    hook.unmount();
  });
});
