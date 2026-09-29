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
import type { CollectionSearchDescriptor, CollectionSearchGateway } from '../ports/CollectionSearchGateway';

const descriptor: CollectionSearchDescriptor = {
  dataSourceKey: 'main',
  collectionName: 'transport_runs',
  collectionTitle: 'Рейсы',
  keyFields: ['id'],
  titleField: 'run_number',
  searchableFields: [
    { name: 'run_number', title: 'Номер рейса', kind: 'number' },
    { name: 'manager_comment', title: 'Комментарий', kind: 'text' },
    { name: 'vehicle', title: 'Машина', kind: 'text', path: ['vehicle', 'registration_number'] },
  ],
  relations: [
    {
      fieldName: 'vehicle',
      targetCollectionName: 'vehicles',
      targetKey: 'id',
      sourceKey: 'id',
      associationType: 'belongsTo',
    },
  ],
};

class SearchGatewayStub implements CollectionSearchGateway {
  synchronizationCount = 0;

  constructor(private readonly collection: CollectionSearchDescriptor | null) {}

  async describeCurrentCollection() {
    return this.collection;
  }

  async ensureIndex() {
    this.synchronizationCount += 1;
  }
}

describe('SearchCurrentCollection', () => {
  it('prepares an indexed search plan for all searchable collection fields', async () => {
    const gateway = new SearchGatewayStub(descriptor);

    const result = await new SearchCurrentCollection(gateway).execute({ term: '  P762  ' });

    expect(result).toEqual({
      term: 'P762',
      dataSourceKey: 'main',
      collectionName: 'transport_runs',
      keyFields: ['id'],
      searchableFieldNames: ['run_number', 'manager_comment', 'vehicle'],
    });
    expect(gateway.synchronizationCount).toBe(1);
  });

  it('limits searchable indexed fields to fields allowed by ACL', async () => {
    const result = await new SearchCurrentCollection(new SearchGatewayStub(descriptor)).execute({
      term: '762',
      permittedFieldNames: ['run_number', 'vehicle.registration_number'],
    });

    expect(result.searchableFieldNames).toEqual(['run_number', 'vehicle']);
  });

  it('limits search to fields selected in the action settings', async () => {
    const result = await new SearchCurrentCollection(new SearchGatewayStub(descriptor)).execute({
      term: '762',
      requestedFieldNames: ['vehicle', 'manager_comment'],
      permittedFieldNames: ['run_number', 'manager_comment', 'vehicle.registration_number'],
    });

    expect(result.searchableFieldNames).toEqual(['manager_comment', 'vehicle']);
  });

  it('accepts exactly three characters and rejects shorter terms', async () => {
    const search = new SearchCurrentCollection(new SearchGatewayStub(descriptor));

    await expect(search.execute({ term: 'abc' })).resolves.toMatchObject({ term: 'abc' });
    await expect(search.execute({ term: 'ab' })).rejects.toMatchObject({ code: 'SEARCH_TERM_TOO_SHORT' });
  });

  it('rejects missing collections and collections without permitted searchable fields', async () => {
    await expect(
      new SearchCurrentCollection(new SearchGatewayStub(null)).execute({ term: '628' }),
    ).rejects.toMatchObject({
      code: 'COLLECTION_NOT_FOUND',
    });

    await expect(
      new SearchCurrentCollection(new SearchGatewayStub(descriptor)).execute({
        term: '628',
        permittedFieldNames: ['secret'],
      }),
    ).rejects.toMatchObject({ code: 'NO_SEARCHABLE_FIELDS' });
  });

  it('propagates index storage failures', async () => {
    class FailingGateway extends SearchGatewayStub {
      override async ensureIndex() {
        throw new Error('Search storage is unavailable');
      }
    }

    await expect(new SearchCurrentCollection(new FailingGateway(descriptor)).execute({ term: '628' })).rejects.toThrow(
      'Search storage is unavailable',
    );
  });
});
