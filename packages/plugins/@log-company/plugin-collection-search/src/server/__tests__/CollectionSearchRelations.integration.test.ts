/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { BelongsToManyRepository, createMockDatabase, type Database, type Model } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import collectionSearchDocuments from '../collections/collectionSearchDocuments';
import collectionSearchStates from '../collections/collectionSearchStates';
import {
  describeCollection,
  NocoBaseSearchIndexRepository,
} from '../infrastructure/persistence/nocobase/NocoBaseSearchIndexRepository';
import { CollectionSearchIndexSubscriber } from '../interfaces/hooks/CollectionSearchIndexSubscriber';

describe('collection search relation indexing', () => {
  let database: Database;

  beforeEach(async () => {
    database = await createMockDatabase();
    database.collection(collectionSearchDocuments);
    database.collection(collectionSearchStates);
    database.collection({
      name: 'search_test_vehicles',
      titleField: 'registration_number',
      fields: [{ type: 'string', name: 'registration_number' }],
    });
    database.collection({
      name: 'search_test_users',
      titleField: 'nickname',
      fields: [{ type: 'string', name: 'nickname' }],
    });
    database.collection({
      name: 'search_test_runs',
      titleField: 'run_number',
      fields: [
        { type: 'integer', name: 'run_number' },
        { type: 'bigInt', name: 'vehicle_id', isForeignKey: true },
        {
          type: 'belongsTo',
          name: 'vehicle',
          target: 'search_test_vehicles',
          foreignKey: 'vehicle_id',
          targetKey: 'id',
          sourceKey: 'id',
          hidden: true,
          uiSchema: { title: 'Машина' },
        },
        {
          type: 'belongsToMany',
          name: 'managers',
          target: 'search_test_users',
          through: 'search_test_run_managers',
          sourceKey: 'id',
          targetKey: 'id',
          foreignKey: 'run_id',
          otherKey: 'user_id',
          uiSchema: { title: 'Менеджеры' },
        },
      ],
    });
    await database.sync();
  });

  afterEach(async () => {
    await database.clean({ drop: true });
    await database.close();
  });

  it('indexes a related title field and refreshes source documents when the target changes', async () => {
    const vehicleRepository = database.getRepository('search_test_vehicles');
    const runRepository = database.getRepository('search_test_runs');
    const vehicle = (await vehicleRepository.create({ values: { registration_number: 'P762MH' } })) as Model;
    const run = (await runRepository.create({ values: { run_number: 15, vehicle_id: vehicle.get('id') } })) as Model;
    const runCollection = database.getCollection('search_test_runs');
    const descriptor = describeCollection(runCollection, 'main');
    if (!descriptor) {
      throw new Error('The relation search descriptor was not created.');
    }
    const plugin = {
      db: database,
      app: {
        dataSourceManager: {
          get: () => ({ collectionManager: { db: database } }),
        },
      },
    } as unknown as Plugin;
    const repository = new NocoBaseSearchIndexRepository(plugin);
    const findIndexedDocuments = async (term: string) =>
      database.getRepository('lc_collection_search_documents').find({
        filter: {
          dataSourceKey: 'main',
          collectionName: runCollection.name,
          'searchText.$includes': term,
        },
      });

    await repository.ensureSynchronized(descriptor, database, runCollection);

    await expect(findIndexedDocuments('762')).resolves.toHaveLength(1);
    const repositoryAfterRestart = new NocoBaseSearchIndexRepository(plugin);
    await repositoryAfterRestart.loadReadyStates();
    await vehicleRepository.update({
      filterByTk: vehicle.get('id'),
      values: { registration_number: 'KOR-999' },
    });
    const updatedVehicle = (await vehicleRepository.findOne({ filterByTk: vehicle.get('id') })) as Model;
    await repositoryAfterRestart.refreshDependentsOfChangedModel(
      'main',
      database.getCollection('search_test_vehicles'),
      updatedVehicle,
      {},
    );

    await expect(findIndexedDocuments('762')).resolves.toHaveLength(0);
    await expect(findIndexedDocuments('kor-999')).resolves.toHaveLength(1);

    await repository.removeSourceModel('main', runCollection, run, {});
  });

  it('refreshes a source document when a many-to-many relation changes', async () => {
    const runCollection = database.getCollection('search_test_runs');
    const descriptor = describeCollection(runCollection, 'main');
    if (!descriptor) {
      throw new Error('The relation search descriptor was not created.');
    }
    const plugin = {
      db: database,
      app: {
        dataSourceManager: {
          get: () => ({ collectionManager: { db: database } }),
        },
      },
    } as unknown as Plugin;
    const repository = new NocoBaseSearchIndexRepository(plugin);
    new CollectionSearchIndexSubscriber({ name: 'main', collectionManager: { db: database } }, repository).register();

    const run = await database.getRepository('search_test_runs').create({ values: { run_number: 16 } });
    const manager = await database.getRepository('search_test_users').create({ values: { nickname: 'Анна' } });
    await repository.ensureSynchronized(descriptor, database, runCollection);
    const relationRepository = new BelongsToManyRepository(runCollection, 'managers', run.get('id'));
    const findIndexedDocuments = async (term: string) =>
      database.getRepository('lc_collection_search_documents').find({
        filter: {
          dataSourceKey: 'main',
          collectionName: runCollection.name,
          'searchText.$includes': term,
        },
      });

    await expect(findIndexedDocuments('Анна')).resolves.toHaveLength(0);
    await relationRepository.add(manager.get('id'));
    await expect(findIndexedDocuments('Анна')).resolves.toHaveLength(1);

    await relationRepository.remove(manager.get('id'));
    await expect(findIndexedDocuments('Анна')).resolves.toHaveLength(0);
  });
});
