/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { requireTransportType } from '../TransportType';

describe('required transport type', () => {
  it.each(['road', 'rail', 'air', 'sea'])('accepts %s', (value) => expect(requireTransportType(value)).toBe(value));
  it.each([undefined, null, '', 'truck', 1])('rejects an absent or unsupported type: %s', (value) => {
    expect(() => requireTransportType(value)).toThrow('Выберите тип перевозки');
  });
});
