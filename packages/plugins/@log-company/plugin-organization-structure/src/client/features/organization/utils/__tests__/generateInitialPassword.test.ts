/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { satisfiesPasswordPolicy } from '../../../../../shared/passwordPolicy';
import { generateInitialPassword } from '../generateInitialPassword';

describe('generateInitialPassword', () => {
  it('generates exactly ten characters with every required character class', () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const password = generateInitialPassword();
      expect(password).toHaveLength(10);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!#$%^&*\-_+=]/);
      expect(satisfiesPasswordPolicy(password)).toBe(true);
    }
  });

  it('does not reuse a deterministic password across calls', () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generateInitialPassword()));
    expect(passwords.size).toBeGreaterThan(1);
  });
});
