/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, it, expect } from 'vitest';
import { buildRunJSCompletions } from '../runjsCompletions';

describe('RunJS snippets locales (client completions)', () => {
  it('should fall back to English snippet labels for ru-RU', async () => {
    const hostCtx = {
      model: { constructor: { name: 'JSBlockModel' } },
      api: { auth: { locale: 'ru-RU' } },
    } as any;
    const { entries } = await buildRunJSCompletions(hostCtx, 'v1', 'block');
    const hasDialog = entries.some((entry) => /dialog/i.test(entry.description || ''));
    expect(hasDialog).toBe(true);
  });
});
