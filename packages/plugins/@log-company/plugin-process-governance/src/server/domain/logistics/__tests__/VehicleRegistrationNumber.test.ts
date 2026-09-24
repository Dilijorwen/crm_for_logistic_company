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
  it('normalizes latin case and separators', () => {
    expect(normalizeVehicleRegistrationNumber(' ab-123 cd ')).toBe('AB123CD');
  });

  it('normalizes visually identical Cyrillic plate letters', () => {
    expect(normalizeVehicleRegistrationNumber('а 123 вс-125')).toBe('A123BC125');
  });

  it.each(['', 'A', '京A12345', 'ABC_123', null])('rejects an unsupported registration number: %s', (value) => {
    expect(() => normalizeVehicleRegistrationNumber(value)).toThrow();
  });
});
