/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useEffect, useRef } from 'react';
import { useField, useForm } from '@formily/react';
import { onFieldValueChange, type Field } from '@formily/core';
import { useCollectionRecord } from '@nocobase/client';
import { categoryFieldState, categoryValue } from './categoryFields';

export function usePermitDocumentFieldProps() {
  const form = useForm();
  const field = useField<Field>();
  const record = useCollectionRecord();
  const effectKey = useRef(Symbol('permit-document-category'));
  useEffect(() => {
    if (!form || !field || field.pattern === 'readPretty') return;
    const apply = () => {
      const category = categoryValue(form.values.category);
      if (category === 'voluntary') form.setValuesIn('document_type', 'certificate_of_conformity');
      if (category === 'rented') {
        form.setValuesIn('company', null);
        form.setValuesIn('company_id', null);
      } else {
        form.setValuesIn('rental_from', null);
        form.setValuesIn('rental_until', null);
      }
      if (category === 'voluntary' && record?.isNew !== false) form.setValuesIn('related_document', null);
      form.query('*').forEach((item) => {
        const state = categoryFieldState(category, String(item.path.segments.slice(-1)[0]), record?.isNew !== false);
        if (!state || item.pattern === 'readPretty') return;
        item.setState({ visible: state.visible, required: state.required });
        item.setComponentProps({ disabled: state.disabled });
      });
    };
    apply();
    const key = effectKey.current;
    form.addEffects(key, () => onFieldValueChange('category', apply));
    return () => form.removeEffects(key);
  }, [form, field, record?.isNew]);
  const state = categoryFieldState(
    categoryValue(form?.values.category),
    String(field?.path.segments.slice(-1)[0]),
    record?.isNew !== false,
  );
  return state ? { disabled: state.disabled } : {};
}
