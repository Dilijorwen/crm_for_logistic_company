/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { FlowRunJSContext } from '../../flowContext';

export class JSBlockRunJSContext extends FlowRunJSContext {}

JSBlockRunJSContext.define({
  label: 'RunJS context',
  properties: {
    element: {
      description: `ElementProxy instance providing a safe DOM container.
      Supports innerHTML, append, and other DOM manipulation methods.
      Use this to render content in the JS block.`,
      detail: 'ElementProxy',
      properties: {
        innerHTML: 'Set or read the HTML content of the container element.',
      },
    },
    record: `Current record data object (read-only).
      Available when the JS block is within a data block or detail view context.`,
    value: 'Current value of the field or component, if available in the current context.',
    React: 'React library',
    antd: 'Ant Design library',
  },
  methods: {
    onRefReady: `Wait for container DOM element to be ready before executing callback.
      Parameters: (ref: React.RefObject, callback: (element: HTMLElement) => void, timeout?: number) => void
      Example: ctx.onRefReady(ctx.ref, (el) => { el.innerHTML = "Ready!" })`,
    requireAsync: 'Load external library: `const lib = await ctx.requireAsync(url)`',
    importAsync:
      'Dynamically import an ESM module by URL: `const mod = await ctx.importAsync(url)`.\n' +
      'Note: if the module has only a default export, ctx.importAsync returns that default value directly (no `.default`).',
  },
});
