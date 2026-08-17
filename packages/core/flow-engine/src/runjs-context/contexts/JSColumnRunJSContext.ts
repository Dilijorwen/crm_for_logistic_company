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
 * RunJS context for JSColumnModel (table custom column).
 * Focused on per-row rendering with access to current record and cell element.
 */
export class JSColumnRunJSContext extends FlowRunJSContext {}

JSColumnRunJSContext.define({
  label: 'JSColumn RunJS context',
  properties: {
    element:
      'ElementProxy instance providing a safe DOM container for the current table cell. Supports innerHTML/append and basic DOM APIs.',
    record: 'Current row record object (read-only).',
    recordIndex: 'Index of the current row in the page (0-based).',
    collection: 'Collection definition metadata (read-only).',
    viewer:
      'View controller providing dialog/drawer/embed helpers for interactions initiated from the cell (e.g., open details).',
    React: 'React library',
    antd: 'Ant Design library',
  },
  methods: {
    onRefReady:
      'Wait for cell DOM element to be ready before executing callback. Parameters: (ref, callback, timeout?) => void',
    requireAsync: 'Load external library by URL: `const lib = await ctx.requireAsync(url)`',
    importAsync: 'Dynamically import ESM module by URL: `const mod = await ctx.importAsync(url)`',
  },
});
