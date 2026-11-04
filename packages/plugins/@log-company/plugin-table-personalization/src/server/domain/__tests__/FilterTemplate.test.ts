/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { filterPaths, parseSavedFilter, parseTemplateName } from '../FilterTemplate';
import { emptyFilter } from '../../../shared/filterTemplates';

describe('saved filter invariants', () => {
  it('preserves nested groups, dynamic values and operators without a value', () => {
    const filter = {
      logic: '$or',
      items: [
        { path: 'createdAt', operator: '$dateOn', value: { type: 'relative', value: 'today' } },
        {
          logic: '$and',
          items: [
            { path: 'department.name', operator: '$eq', value: 'Отдел' },
            { path: 'active', operator: '$isTruly', noValue: true },
          ],
        },
      ],
    };
    const result = parseSavedFilter(filter);
    expect(result).toEqual(filter);
    expect(result).not.toBe(filter);
    expect(filterPaths(result)).toEqual(['createdAt', 'department.name', 'active']);
    expect(parseSavedFilter(emptyFilter())).toEqual(emptyFilter());
  });

  it.each([
    null,
    { logic: '$and' },
    { logic: '$not', items: [] },
    { logic: '$and', items: [], sort: ['id'] },
    { logic: '$and', items: [{ path: '', operator: '$eq', value: 1 }] },
    { logic: '$and', items: [{ path: 'id', operator: '', value: 1 }] },
    { logic: '$and', items: [{ path: 'constructor.id', operator: '$eq', value: 1 }] },
    { logic: '$and', items: [{ path: 'id', operator: '$sql', value: 'select 1' }] },
    { logic: '$and', items: [{ path: 'id', operator: '$eq' }] },
    { logic: '$and', items: [{ path: 'id', operator: '$eq', value: Number.NaN }] },
    { logic: '$and', items: [{ path: 'id', operator: '$eq', value: 'x'.repeat(65536) }] },
    { logic: '$and', items: Array.from({ length: 100 }, () => ({ path: 'id', operator: '$eq', value: 1 })) },
  ])('rejects invalid or oversized conditions: %j', (value) => {
    expect(() => parseSavedFilter(value)).toThrow('INVALID_TEMPLATE');
  });

  it('bounds recursive group depth and rejects unsafe JSON keys', () => {
    let filter = emptyFilter();
    for (let index = 0; index < 12; index++) filter = { logic: '$and', items: [filter] };
    expect(() => parseSavedFilter(filter)).toThrow('INVALID_TEMPLATE');
    expect(() =>
      parseSavedFilter(JSON.parse('{"logic":"$and","items":[{"path":"id","operator":"$eq","value":{"__proto__":1}}]}')),
    ).toThrow('INVALID_TEMPLATE');
  });

  it('trims names and accepts the maximum length', () => {
    expect(parseTemplateName('  Мой фильтр  ')).toBe('Мой фильтр');
    expect(parseTemplateName('Я'.repeat(100))).toHaveLength(100);
  });

  it.each(['', '  ', 'x'.repeat(101), 'name\nname', null])('rejects invalid names: %j', (name) => {
    expect(() => parseTemplateName(name)).toThrow('INVALID_TEMPLATE');
  });
});
