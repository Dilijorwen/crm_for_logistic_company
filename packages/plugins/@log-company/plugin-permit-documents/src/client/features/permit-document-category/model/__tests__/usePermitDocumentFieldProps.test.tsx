/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { act, render } from '@testing-library/react';
import { createForm } from '@formily/core';
import { Field, FormProvider } from '@formily/react';
import { describe, expect, it, vi } from 'vitest';
import { usePermitDocumentFieldProps } from '../usePermitDocumentFieldProps';

const record = vi.hoisted(() => ({ isNew: true }));
vi.mock('@nocobase/client', () => ({ useCollectionRecord: () => record }));

function CategoryField() {
  usePermitDocumentFieldProps();
  return null;
}

describe('category-dependent Formily form', () => {
  it('changes visibility and requirements, forces voluntary CC, clears rental company and old rental dates', async () => {
    record.isNew = true;
    const form = createForm({ values: { category: 'ordinary', company: '1' } });
    const view = render(
      <FormProvider form={form}>
        <Field name="category" component={CategoryField} />
        {[
          'company',
          'related_document',
          'rental_from',
          'rental_until',
          'valid_from',
          'manufacturer_name',
          'technical_regulations',
          'documents',
          'document_type',
        ].map((name) => (
          <Field key={name} name={name} />
        ))}
      </FormProvider>,
    );
    await act(async () => form.setValuesIn('category', 'voluntary'));
    expect(form.values.document_type).toBe('certificate_of_conformity');
    expect(form.query('related_document').take()?.visible).toBe(false);
    expect(form.query('manufacturer_name').take()?.required).toBe(true);
    expect(form.query('documents').take()?.required).toBe(true);
    await act(async () => form.setValuesIn('category', 'rented'));
    expect(form.values.company == null).toBe(true);
    expect(form.query('company').take()?.visible).toBe(false);
    expect(form.query('rental_from').take()?.required).toBe(true);
    expect(form.query('rental_until').take()?.required).toBe(true);
    form.setValuesIn('rental_from', '2026-01-01');
    await act(async () => form.setValuesIn('category', 'ordinary'));
    expect(form.values.rental_from == null).toBe(true);
    view.unmount();
  });

  it('applies editable category fields in an existing popup without changing field order or requesting the registry', async () => {
    record.isNew = false;
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
    const form = createForm({
      values: { id: '1', category: 'rented', rental_from: '2026-01-01', rental_until: '2027-01-01' },
    });
    const view = render(
      <FormProvider form={form}>
        {names.map((name) => (
          <Field key={name} name={name} component={name === 'category' ? CategoryField : undefined} />
        ))}
      </FormProvider>,
    );
    expect(form.query('rental_until').take()?.visible).toBe(true);
    expect(form.values.rental_until).toBe('2027-01-01');
    for (const name of ['status', 'company', 'related_document', 'period_from', 'technical_regulations', 'valid_from'])
      expect(form.query(name).take()?.visible).toBe(false);
    await act(async () => form.setValuesIn('category', 'voluntary'));
    for (const name of [
      'valid_from',
      'valid_until',
      'product_information',
      'manufacturer_name',
      'manufacturer_address',
      'technical_regulations',
      'company',
      'documents',
    ]) {
      expect(form.query(name).take()?.visible).toBe(true);
      expect(form.query(name).take()?.required).toBe(true);
    }
    expect(form.query('rental_until').take()?.visible).toBe(false);
    view.unmount();
  });
});
