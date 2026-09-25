/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { normalizeVehicleRegistrationNumber } from '../VehicleRegistrationNumber';

describe('normalizeVehicleRegistrationNumber', () => {
  it('normalizes latin case, removes spaces and preserves special characters', () => {
    expect(normalizeVehicleRegistrationNumber(' ab/123.cd_45\\6 ')).toBe('AB/123.CD_45\\6');
  });

  it('normalizes visually identical Cyrillic plate letters', () => {
    expect(normalizeVehicleRegistrationNumber('а 123 вс-125')).toBe('A123BC-125');
  });

  it.each(['', 'A', '京A/12345', 'AB😀123', null])('rejects an unsupported registration number: %s', (value) => {
    expect(() => normalizeVehicleRegistrationNumber(value)).toThrow();
  });
});
