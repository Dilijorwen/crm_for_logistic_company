/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { getValidateRules } from '@formily/validator';
import { describe, expect, it, vi } from 'vitest';
import { registerPasswordPolicyValidator } from '../registerPasswordPolicyValidator';

describe('registerPasswordPolicyValidator', () => {
  it('registers the standard Formily password rule used by NocoBase forms', () => {
    const t = vi.fn(() => 'Use a strong password');
    registerPasswordPolicyValidator(t);
    const passwordRule = getValidateRules().password;

    expect(passwordRule('1234', {})).toBe('Use a strong password');
    expect(passwordRule('StrongPass1!', {})).toBe(true);
    expect(passwordRule('', {})).toBe('');
    expect(t).toHaveBeenCalledWith('validation.passwordPolicy');
  });
});
