/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, satisfiesPasswordPolicy } from '../passwordPolicy';

describe('passwordPolicy', () => {
  it('accepts passwords at the supported length boundaries', () => {
    expect(satisfiesPasswordPolicy(`Aa1!${'x'.repeat(PASSWORD_MIN_LENGTH - 4)}`)).toBe(true);
    expect(satisfiesPasswordPolicy(`Aa1!${'x'.repeat(PASSWORD_MAX_LENGTH - 4)}`)).toBe(true);
  });

  it.each([
    ['a short password', 'Aa1!short'],
    ['a password over the maximum length', `Aa1!${'x'.repeat(PASSWORD_MAX_LENGTH - 3)}`],
    ['a password without an uppercase Latin letter', 'abcdefghi1!'],
    ['a password without a lowercase Latin letter', 'ABCDEFGHI1!'],
    ['a password without a digit', 'Abcdefghij!'],
    ['a password without a special character', 'Abcdefghi1'],
    ['a password containing whitespace', 'Abcdef1! x'],
    ['a non-string value', 1234567890],
  ])('rejects %s', (_caseName, value) => {
    expect(satisfiesPasswordPolicy(value)).toBe(false);
  });
});
