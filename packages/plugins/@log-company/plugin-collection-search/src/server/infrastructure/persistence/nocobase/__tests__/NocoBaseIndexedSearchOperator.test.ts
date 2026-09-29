/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createMockDatabase, FilterParser, type Database } from '@nocobase/database';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import collectionSearchDocuments from '../../../../collections/collectionSearchDocuments';
import { COLLECTION_SEARCH_OPERATOR, createIndexedCollectionSearchOperator } from '../NocoBaseIndexedSearchOperator';

describe('NocoBaseIndexedSearchOperator', () => {
  let database: Database;

  beforeEach(async () => {
    database = await createMockDatabase();
    database.collection(collectionSearchDocuments);
    database.collection({
      name: 'indexed_search_test_records',
      fields: [{ type: 'string', name: 'title' }],
    });
    database.registerOperators({
      [COLLECTION_SEARCH_OPERATOR]: createIndexedCollectionSearchOperator(database),
    });
  });

  afterEach(async () => {
    await database.close();
  });

  it('generates one correlated EXISTS condition instead of an id list', () => {
    const collection = database.getCollection('indexed_search_test_records');
    const parser = new FilterParser(
      {
        [`id.${COLLECTION_SEARCH_OPERATOR}`]: {
          term: '762',
          dataSourceKey: 'main',
          collectionName: collection.name,
          keyFields: ['id'],
          searchableFieldNames: ['title'],
        },
      },
      { collection },
    );
    const query = database.sequelize
      .getQueryInterface()
      .queryGenerator.selectQuery(collection.model.getTableName(), parser.toSequelizeParams(), collection.model);

    expect(query).toContain('EXISTS');
    expect(query).toContain('lc_collection_search_documents');
    expect(query).toContain('ILIKE');
    expect(query).not.toContain(' IN (');
    expect(query).not.toMatch(/"id"\s*=\s*EXISTS/);
  });
});
