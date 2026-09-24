/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { LogisticsError } from '../LogisticsError';
import { normalizeShipmentDecimal } from '../ShipmentDecimal';

describe('normalizeShipmentDecimal', () => {
  it.each([
    ['1,0', 1],
    ['1.0', 1],
    ['0,25', 0.25],
    ['1 234,50', 1234.5],
    ['1\u202f234.50', 1234.5],
    [0, 0],
    [12.75, 12.75],
  ])('normalizes %s to %s', (value, expected) => {
    expect(normalizeShipmentDecimal(value, 'Стоимость')).toBe(expected);
  });

  it('preserves empty optional values', () => {
    expect(normalizeShipmentDecimal(undefined, 'Стоимость')).toBeUndefined();
    expect(normalizeShipmentDecimal(null, 'Стоимость')).toBeNull();
    expect(normalizeShipmentDecimal('', 'Стоимость')).toBeNull();
  });

  it.each(['-1', '1,2.3', '1,2,3', 'NaN', Number.POSITIVE_INFINITY, true])('rejects invalid value %s', (value) => {
    expect(() => normalizeShipmentDecimal(value, 'Стоимость по инвойсу')).toThrowError(
      expect.objectContaining<Partial<LogisticsError>>({
        code: 'INVALID_SHIPMENT_DECIMAL',
        message: expect.stringContaining('Стоимость по инвойсу'),
      }),
    );
  });
});
