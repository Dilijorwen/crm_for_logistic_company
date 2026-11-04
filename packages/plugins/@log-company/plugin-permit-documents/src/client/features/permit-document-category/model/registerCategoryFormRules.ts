/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { FormBlockModel, FieldModel } from '@nocobase/client';
import type { FormInstance } from 'antd';
import { categoryFieldState, categoryValue } from './categoryFields';

interface FormNode {
  collectionField?: { name: string; collectionName: string };
  subModels?: Record<string, FormNode | FormNode[]>;
  setProps(props: Record<string, unknown>): void;
  updateAssociation?: boolean;
}

function applyFields(node: FormNode, form: FormInstance, isNew: boolean): void {
  const category = categoryValue(form.getFieldValue('category'));
  const field = node.collectionField;
  if (field?.collectionName === 'permit_documents') {
    const state = categoryFieldState(category, field.name, isNew);
    if (state) {
      node.setProps({
        hidden: !state.visible,
        required: state.required,
        rules: state.required ? [{ required: true, message: 'Заполните поле.' }] : [],
      });
      const child = node.subModels?.field as FormNode | undefined;
      child?.setProps({ disabled: state.disabled });
      if (child && field.name === 'technical_regulations') child.updateAssociation = false;
    }
  }
  for (const value of Object.values(node.subModels ?? {})) {
    for (const child of Array.isArray(value) ? value : [value]) applyFields(child, form, isNew);
  }
}

export function registerCategoryFormRules(): void {
  FieldModel.registerFlow({
    key: 'permitDocumentCategoryField',
    sort: 2000,
    steps: {
      apply: {
        handler(context) {
          if (
            context.collection?.name !== 'permit_documents' ||
            !context.form ||
            !context.model.parent ||
            !(context.blockModel instanceof FormBlockModel) ||
            !['create', 'update'].includes(context.actionName)
          )
            return;
          applyFields(
            context.model.parent as unknown as FormNode,
            context.form as FormInstance,
            context.actionName === 'create',
          );
        },
      },
    },
  });
  for (const on of ['beforeRender', 'formValuesChange'] as const) {
    FormBlockModel.registerFlow({
      key: `permitDocumentCategory-${on}`,
      on,
      sort: 2000,
      steps: {
        applyCategory: {
          handler(context) {
            if (context.collection?.name !== 'permit_documents' || !context.form) return;
            const form = context.form as FormInstance;
            const category = categoryValue(form.getFieldValue('category') ?? context.record?.category);
            if (form.getFieldValue('category') == null) form.setFieldValue('category', category);
            if (category === 'voluntary') form.setFieldValue('document_type', 'certificate_of_conformity');
            if (category === 'rented') {
              form.setFieldValue('company', null);
              form.setFieldValue('company_id', null);
            } else {
              form.setFieldValue('rental_from', null);
              form.setFieldValue('rental_until', null);
            }
            if (category === 'voluntary' && context.actionName === 'create')
              form.setFieldValue('related_document', null);
            applyFields(context.model as unknown as FormNode, form, context.actionName === 'create');
          },
        },
      },
    });
  }
}
