/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Collection, Database, MigrationContext, Model } from '@nocobase/database';
import { createMockDatabase } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import collectionSearchDocuments from '../collections/collectionSearchDocuments';
import collectionSearchStates from '../collections/collectionSearchStates';
import {
  describeCollection,
  NocoBaseSearchIndexRepository,
} from '../infrastructure/persistence/nocobase/NocoBaseSearchIndexRepository';
import CreateCollectionSearchIndexMigration from '../migrations/20260728120000-create-collection-search-index';

const runPostgresIntegration =
  process.env.COLLECTION_SEARCH_POSTGRES_INTEGRATION === '1' && process.env.DB_DIALECT === 'postgres';

describe.runIf(runPostgresIntegration)('collection search PostgreSQL index', () => {
  let database: Database;
  let migration: CreateCollectionSearchIndexMigration;
  let sourceCollection: Collection;
  let indexRepository: NocoBaseSearchIndexRepository;

  beforeAll(async () => {
    if (!process.env.DB_TEST_PREFIX?.startsWith('collection_search_test')) {
      throw new Error(
        'Collection search integration tests require an isolated DB_TEST_PREFIX beginning with collection_search_test.',
      );
    }
    database = await createMockDatabase();
    await database.clean({ drop: true });
    database.collection(collectionSearchDocuments);
    database.collection(collectionSearchStates);
    sourceCollection = database.collection({
      name: 'collection_search_source_records',
      fields: [
        { type: 'string', name: 'title' },
        { type: 'string', name: 'reference' },
      ],
    });
    await database.sync();
    const context: MigrationContext = {
      db: database,
      queryInterface: database.sequelize.getQueryInterface(),
      sequelize: database.sequelize,
    };
    migration = new CreateCollectionSearchIndexMigration(context);
    await migration.up();
    indexRepository = new NocoBaseSearchIndexRepository({ db: database } as unknown as Plugin);
  });

  afterAll(async () => {
    if (migration) {
      await migration.down();
    }
    if (database) {
      await database.clean({ drop: true });
      await database.close();
    }
  });

  it('creates pg_trgm storage and keeps indexed records synchronized', async () => {
    const sourceRepository = database.getRepository(sourceCollection.name);
    const first = (await sourceRepository.create({
      values: { title: 'Customs declaration 628', reference: 'DT-2026-001' },
    })) as Model;
    await sourceRepository.create({
      values: { title: 'Unrelated record', reference: 'DT-2026-002' },
    });
    const descriptor = describeCollection(sourceCollection, 'main');
    if (!descriptor) {
      throw new Error('The integration test collection must be searchable.');
    }

    await indexRepository.ensureSynchronized(descriptor, database, sourceCollection);

    const initialCandidates = await indexRepository.findCandidates({
      descriptor,
      term: 'DECLARATION 628',
      limit: 20,
    });
    expect(initialCandidates).toHaveLength(1);
    expect(String(initialCandidates[0].keyValues.id)).toBe(String(first.get('id')));

    await sourceRepository.update({
      filterByTk: first.get('id'),
      values: { title: 'Released shipment', reference: 'DT-2026-999' },
    });
    const updated = (await sourceRepository.findOne({ filterByTk: first.get('id') })) as Model;
    await indexRepository.upsertSourceModel('main', sourceCollection, updated, {});

    await expect(
      indexRepository.findCandidates({ descriptor, term: 'declaration 628', limit: 20 }),
    ).resolves.toHaveLength(0);
    await expect(
      indexRepository.findCandidates({ descriptor, term: 'released shipment', limit: 20 }),
    ).resolves.toHaveLength(1);

    await indexRepository.removeSourceModel('main', sourceCollection, updated, {});
    await expect(
      indexRepository.findCandidates({ descriptor, term: 'released shipment', limit: 20 }),
    ).resolves.toHaveLength(0);

    const [indexes] = (await database.sequelize.query(
      `select indexdef
       from pg_indexes
       where indexname = 'lc_collection_search_documents_search_text_trgm'`,
    )) as unknown as [Array<{ indexdef: string }>, unknown];
    expect(indexes[0]?.indexdef).toContain('USING gin');
    expect(indexes[0]?.indexdef).toContain('gin_trgm_ops');
  });
});
