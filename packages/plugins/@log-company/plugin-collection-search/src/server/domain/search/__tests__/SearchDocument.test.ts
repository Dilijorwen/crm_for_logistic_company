/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import {
  buildSearchDocument,
  findSearchMatches,
  formatSearchFieldValue,
  normalizePageSize,
  normalizeSearchTerm,
  type SearchableField,
} from '../SearchDocument';

const fields: SearchableField[] = [
  { name: 'car_number', title: 'Car number', kind: 'text' },
  { name: 'declaration_number', title: 'Declaration number', kind: 'text' },
  { name: 'registered_at', title: 'Registered at', kind: 'date' },
  { name: 'completed', title: 'Completed', kind: 'boolean' },
  {
    name: 'status',
    title: 'Status',
    kind: 'text',
    enum: [{ value: 'in_progress', label: 'В работе' }],
  },
];

describe('SearchDocument', () => {
  it('finds the same substring in different collection fields', () => {
    const matches = findSearchMatches(
      {
        car_number: 'А628ВС',
        declaration_number: '10702070/280726/00628',
      },
      fields,
      '628',
    );

    expect(matches.map((match) => match.fieldName)).toEqual(['car_number', 'declaration_number']);
  });

  it('indexes dates in ISO and Russian display formats', () => {
    const document = buildSearchDocument(
      {
        registered_at: new Date('2026-07-28T01:00:00.000Z'),
      },
      fields,
    );

    expect(document.searchText).toContain('2026-07-28');
    expect(document.searchText).toContain('28.07.2026');
    expect(document.values.registered_at.raw).toBe('2026-07-28T01:00:00.000Z');
  });

  it('indexes enum labels and localized boolean terms', () => {
    expect(formatSearchFieldValue(fields[3], false)).toMatchObject({
      raw: false,
      display: 'false',
      searchText: 'false no нет 0',
    });
    expect(buildSearchDocument({ status: 'in_progress' }, fields).searchText).toBe('В работе in_progress');
  });

  it('validates term length and page size boundaries', () => {
    expect(normalizeSearchTerm('  628  ')).toBe('628');
    expect(() => normalizeSearchTerm('62')).toThrowError(/at least 3/);
    expect(() => normalizeSearchTerm('x'.repeat(101))).toThrowError(/no more than 100/);
    expect(normalizePageSize(undefined)).toBe(20);
    expect(normalizePageSize(50)).toBe(50);
    expect(() => normalizePageSize(51)).toThrowError(/between 1 and 50/);
  });
});
