/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { SearchCurrentCollection } from '../SearchCurrentCollection';
import type {
  AccessibleSearchRecord,
  CollectionSearchDescriptor,
  CollectionSearchGateway,
  IndexedSearchCandidate,
} from '../ports/CollectionSearchGateway';

const descriptor: CollectionSearchDescriptor = {
  dataSourceKey: 'main',
  collectionName: 'customs_processes',
  collectionTitle: 'Таможенное оформление',
  keyFields: ['id'],
  titleField: 'title',
  searchableFields: [
    { name: 'car_number', title: 'Номер машины', kind: 'text' },
    { name: 'declaration_number', title: 'Номер ДТ', kind: 'text' },
  ],
};

class SearchGatewayStub implements CollectionSearchGateway {
  synchronizationCount = 0;

  constructor(
    private readonly collection: CollectionSearchDescriptor | null,
    private readonly candidates: IndexedSearchCandidate[],
    private readonly records: AccessibleSearchRecord[],
  ) {}

  async describeCurrentCollection() {
    return this.collection;
  }

  async ensureIndex() {
    this.synchronizationCount += 1;
  }

  async findCandidates(input: { cursor?: string; limit: number }) {
    const start = input.cursor ? this.candidates.findIndex((candidate) => candidate.cursor === input.cursor) + 1 : 0;
    return this.candidates.slice(start, start + input.limit);
  }

  async findAccessibleRecords(input: { candidates: IndexedSearchCandidate[] }) {
    const ids = new Set(input.candidates.map((candidate) => candidate.keyValues.id));
    return this.records.filter((record) => ids.has(record.keyValues.id));
  }
}

describe('SearchCurrentCollection', () => {
  it('returns matches from multiple fields and initializes the index', async () => {
    const gateway = new SearchGatewayStub(
      descriptor,
      [
        { cursor: '{"id":1}', keyValues: { id: 1 } },
        { cursor: '{"id":2}', keyValues: { id: 2 } },
      ],
      [
        {
          keyValues: { id: 1 },
          values: { id: 1, title: 'Оформление 1', car_number: 'А628ВС' },
        },
        {
          keyValues: { id: 2 },
          values: { id: 2, title: 'Оформление 2', declaration_number: 'ДТ-628-26' },
        },
      ],
    );

    const result = await new SearchCurrentCollection(gateway).execute({ term: '628' });

    expect(gateway.synchronizationCount).toBe(1);
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.matches[0].fieldName).sort()).toEqual(['car_number', 'declaration_number']);
  });

  it('does not return inaccessible candidate records', async () => {
    const gateway = new SearchGatewayStub(descriptor, [{ cursor: '{"id":1}', keyValues: { id: 1 } }], []);

    const result = await new SearchCurrentCollection(gateway).execute({ term: '628' });

    expect(result.rows).toEqual([]);
  });

  it('matches only fields permitted by ACL', async () => {
    const restrictedDescriptor = {
      ...descriptor,
      permittedFieldNames: ['car_number'],
    };
    const gateway = new SearchGatewayStub(
      restrictedDescriptor,
      [{ cursor: '{"id":1}', keyValues: { id: 1 } }],
      [
        {
          keyValues: { id: 1 },
          values: { id: 1, title: 'Оформление 1', declaration_number: 'ДТ-628-26' },
        },
      ],
    );

    const result = await new SearchCurrentCollection(gateway).execute({ term: '628' });

    expect(result.rows).toEqual([]);
  });

  it('returns a cursor for the next page', async () => {
    const gateway = new SearchGatewayStub(
      descriptor,
      [
        { cursor: '{"id":1}', keyValues: { id: 1 } },
        { cursor: '{"id":2}', keyValues: { id: 2 } },
      ],
      [
        { keyValues: { id: 1 }, values: { id: 1, car_number: '628-A' } },
        { keyValues: { id: 2 }, values: { id: 2, car_number: '628-B' } },
      ],
    );

    const firstPage = await new SearchCurrentCollection(gateway).execute({ term: '628', pageSize: 1 });
    const secondPage = await new SearchCurrentCollection(gateway).execute({
      term: '628',
      pageSize: 1,
      cursor: firstPage.nextCursor,
    });

    expect(firstPage).toMatchObject({ hasNext: true, nextCursor: '{"id":1}' });
    expect(secondPage.rows[0].recordKey).toEqual({ id: 2 });
  });

  it('rejects missing collections and collections without searchable fields', async () => {
    await expect(
      new SearchCurrentCollection(new SearchGatewayStub(null, [], [])).execute({ term: '628' }),
    ).rejects.toMatchObject({ code: 'COLLECTION_NOT_FOUND' });

    await expect(
      new SearchCurrentCollection(new SearchGatewayStub({ ...descriptor, searchableFields: [] }, [], [])).execute({
        term: '628',
      }),
    ).rejects.toMatchObject({ code: 'NO_SEARCHABLE_FIELDS' });
  });

  it('can repeat the same read-only search without changing its result', async () => {
    const gateway = new SearchGatewayStub(
      descriptor,
      [{ cursor: '{"id":1}', keyValues: { id: 1 } }],
      [{ keyValues: { id: 1 }, values: { id: 1, car_number: 'А628ВС' } }],
    );
    const search = new SearchCurrentCollection(gateway);

    const first = await search.execute({ term: '628' });
    const second = await search.execute({ term: '628' });

    expect(second).toEqual(first);
    expect(gateway.synchronizationCount).toBe(2);
  });

  it('propagates index storage failures', async () => {
    class FailingGateway extends SearchGatewayStub {
      override async ensureIndex() {
        throw new Error('Search storage is unavailable');
      }
    }

    await expect(
      new SearchCurrentCollection(new FailingGateway(descriptor, [], [])).execute({ term: '628' }),
    ).rejects.toThrow('Search storage is unavailable');
  });
});
