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
  formatSearchFieldValue,
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
  it('places scalar values from hidden or visible fields in one searchable document', () => {
    const document = buildSearchDocument(
      {
        car_number: 'А628ВС',
        declaration_number: '10702070/280726/00628',
      },
      fields,
    );

    expect(document.searchText).toContain('А628ВС');
    expect(document.searchText).toContain('10702070/280726/00628');
    expect(document.searchText.toLocaleLowerCase()).toContain('628');
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

  it('indexes relation title fields and composite shipment numbers', () => {
    const relationFields: SearchableField[] = [
      { name: 'vehicle', title: 'Машина', kind: 'text', path: ['vehicle', 'registration_number'] },
      { name: 'managers', title: 'Менеджеры', kind: 'text', path: ['managers', 'nickname'] },
      { name: 'display_name', title: 'Название поставки', kind: 'text' },
    ];

    const document = buildSearchDocument(
      {
        vehicle: { registration_number: 'P762MH' },
        managers: [{ nickname: 'Анна' }, { nickname: 'Борис' }],
        display_name: '1/Азия/INV-5328/ЗВ-102/ДТ-555',
      },
      relationFields,
    );

    expect(document.searchText).toContain('P762MH');
    expect(document.values.managers.searchText).toBe('Анна Борис');
    for (const term of ['Азия', 'INV', '532', '102', '555']) {
      expect(document.searchText.toLocaleLowerCase()).toContain(term.toLocaleLowerCase());
    }
  });

  it('validates term length boundaries', () => {
    expect(normalizeSearchTerm('  628  ')).toBe('628');
    expect(() => normalizeSearchTerm('62')).toThrowError(/at least 3/);
    expect(() => normalizeSearchTerm('x'.repeat(101))).toThrowError(/no more than 100/);
  });
});
