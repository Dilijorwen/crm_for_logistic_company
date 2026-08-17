/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { FlowRunJSContext } from '../../flowContext';

/**
 * RunJS context for JSEditableFieldModel (form editable custom field).
 * NOTE: Some APIs (e.g., getValue/setValue/element) are provided by the model's runtime handler.
 * This doc is used for editor autocomplete and AI coding assistance.
 */
export class JSEditableFieldRunJSContext extends FlowRunJSContext {}

JSEditableFieldRunJSContext.define({
  label: 'JSEditableField RunJS context',
  properties: {
    element: {
      description:
        'ElementProxy instance providing a safe DOM container for field rendering. In editable mode this container is typically a <span> element.',
      detail: 'ElementProxy',
    },
    value: {
      description:
        'Current field value (read-only snapshot). In editable scenarios, prefer ctx.getValue()/ctx.setValue(v) for two-way binding.',
      detail: 'any',
      examples: ['const v = ctx.getValue?.() ?? ctx.value;', 'ctx.setValue?.("new value");'],
    },
    record: {
      description: 'Current record data object (read-only). Available in forms that are bound to a record.',
      detail: 'Record<string, any>',
    },
    form: {
      description: 'Ant Design Form instance for reading/writing other fields. Example: ctx.form.getFieldValue("name")',
      detail: 'FormInstance',
    },
    formValues: {
      description:
        'Snapshot of current form values (object). Prefer ctx.form.getFieldsValue() when you need the latest values.',
      detail: 'Record<string, any>',
    },
    namePath: {
      description: 'Field namePath in the form (array). Useful for advanced Form operations.',
      detail: 'Array<string | number>',
    },
    disabled: 'Whether the field is disabled (boolean).',
    readOnly: 'Whether the field is read-only (boolean).',
  },
  methods: {
    getValue: {
      description: 'Get current field value (recommended for editable custom fields).',
      detail: '() => any',
      completion: { insertText: 'ctx.getValue?.()' },
    },
    setValue: {
      description: 'Set current field value (two-way binding with the form).',
      detail: '(value: any) => void',
      completion: { insertText: 'ctx.setValue?.(value)' },
      examples: ['ctx.setValue?.(e.target.value);'],
    },
  },
});
