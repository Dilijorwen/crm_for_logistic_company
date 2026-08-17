/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { getFlowEngineTranslation, initFlowEngineLocale, locales } from '../index';

describe('flow engine locales', () => {
  it('bundles only English and Russian', () => {
    expect(Object.keys(locales)).toEqual(['en-US', 'ru-RU']);
  });

  it('registers both supported locales', () => {
    const addResourceBundle = vi.fn();

    initFlowEngineLocale({ addResourceBundle });

    expect(addResourceBundle).toHaveBeenCalledTimes(2);
    expect(addResourceBundle).toHaveBeenNthCalledWith(1, 'en-US', expect.any(String), locales['en-US'], true, false);
    expect(addResourceBundle).toHaveBeenNthCalledWith(2, 'ru-RU', expect.any(String), locales['ru-RU'], true, false);
  });

  it('falls back to English for unsupported locales', () => {
    expect(getFlowEngineTranslation('Add', 'unsupported')).toBe(locales['en-US'].Add);
  });
});
