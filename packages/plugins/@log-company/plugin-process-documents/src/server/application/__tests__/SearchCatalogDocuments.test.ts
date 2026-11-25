/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { SearchCatalogDocuments, type CatalogSearchReader } from '../SearchCatalogDocuments';

const company = { id: '10', title: 'Компания' };
const path = [{ type: 'company', company }] as const;
const actor = { userId: '5', isRoot: false, authorizationContext: {} };

function setup() {
  const reader: CatalogSearchReader = {
    candidates: vi.fn(async (_query, cursor) =>
      cursor
        ? []
        : ['4', '3', '2', '1'].map((id) => ({
            source: 'scoped' as const,
            id,
            title: 'Инвойс.pdf',
          })),
    ),
    locations: vi.fn(async ({ id }) =>
      id === '4'
        ? []
        : [
            {
              nodes: [...path],
              folders: [{ id: id === '3' ? '123' : '456', title: 'Декларантам' }],
              target: { kind: 'scoped' as const },
            },
          ],
    ),
  };
  return { reader, search: new SearchCatalogDocuments(() => reader) };
}

describe('Поиск файлов', () => {
  it('показывает только разрешённые результаты под выбранной папкой', async () => {
    const { search } = setup();
    const response = await search.execute({ query: 'Инвойс', path: ['company:10'], folderId: '456' }, actor);
    expect(response.rows.map((row) => row.id)).toEqual(['2', '1']);
    expect(response.next).toBeUndefined();
  });

  it('отклоняет слишком короткий запрос до обращения к базе', async () => {
    const { reader, search } = setup();
    await expect(search.execute({ query: ' а ', path: [] }, actor)).rejects.toMatchObject({
      code: 'INVALID_DOCUMENT_SEARCH',
    });
    expect(reader.candidates).not.toHaveBeenCalled();
  });

  it('возвращает продолжение только при наличии следующего видимого файла', async () => {
    const { search, reader } = setup();
    const all = Array.from({ length: 60 }, (_, index) => ({
      id: String(60 - index),
      source: 'scoped' as const,
      title: 'Инвойс.pdf',
    }));
    vi.mocked(reader.candidates).mockImplementation(async (_query, cursor) =>
      all.filter((row) => !cursor || Number(row.id) < Number(cursor.id)),
    );
    const first = await search.execute({ query: 'Инвойс', path: [] }, actor);
    const second = await search.execute({ query: 'Инвойс', path: [], cursor: first.next }, actor);
    expect(first.rows).toHaveLength(50);
    expect(second.rows).toHaveLength(9);
    expect(new Set([...first.rows, ...second.rows].map(({ id }) => id)).size).toBe(59);
    expect(second.next).toBeUndefined();
  });
});
