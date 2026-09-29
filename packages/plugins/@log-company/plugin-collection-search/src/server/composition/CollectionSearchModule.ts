/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import type { Database } from '@nocobase/database';
import { NocoBaseSearchIndexRepository } from '../infrastructure/persistence/nocobase/NocoBaseSearchIndexRepository';
import {
  COLLECTION_SEARCH_OPERATOR,
  createIndexedCollectionSearchOperator,
} from '../infrastructure/persistence/nocobase/NocoBaseIndexedSearchOperator';
import { CollectionSearchIndexSubscriber } from '../interfaces/hooks/CollectionSearchIndexSubscriber';
import { CollectionSearchController } from '../interfaces/http/CollectionSearchController';
import { AuthorizeSearchConfigurationChange } from '../application/AuthorizeSearchConfigurationChange';
import { NocoBaseSearchFlowModelRepository } from '../infrastructure/persistence/nocobase/NocoBaseSearchFlowModelRepository';
import { SearchConfigurationGuard } from '../interfaces/http/SearchConfigurationGuard';

interface SearchDataSource {
  name: string;
  resourceManager: {
    registerActionHandler(name: string, handler: (...args: never[]) => unknown): void;
  };
  acl: {
    getAvailableAction(name: string): { options: { aliases?: string | string[] } } | undefined;
    setAvailableAction(name: string, options: Record<string, unknown>): void;
  };
  collectionManager: {
    db?: Database;
  };
}

export class CollectionSearchModule {
  constructor(private readonly plugin: Plugin) {}

  initialize(): void {
    const indexRepository = new NocoBaseSearchIndexRepository(this.plugin);
    const controller = new CollectionSearchController(this.plugin, indexRepository);
    const configurationGuard = new SearchConfigurationGuard(
      new AuthorizeSearchConfigurationChange(new NocoBaseSearchFlowModelRepository(this.plugin.db)),
    );
    this.plugin.app.resourceManager.use(configurationGuard.handle, {
      tag: 'log-company.collection-search-root-settings',
      after: 'acl',
    });
    this.plugin.app.dataSourceManager.afterAddDataSource((dataSource) => {
      const searchDataSource = dataSource as unknown as SearchDataSource;
      const sourceDatabase = searchDataSource.collectionManager.db;
      if (sourceDatabase) {
        sourceDatabase.registerOperators({
          [COLLECTION_SEARCH_OPERATOR]: createIndexedCollectionSearchOperator(this.plugin.db),
        });
      }
      controller.register(searchDataSource);
      new CollectionSearchIndexSubscriber(
        dataSource as unknown as ConstructorParameters<typeof CollectionSearchIndexSubscriber>[0],
        indexRepository,
      ).register();
    });
    this.plugin.app.on('afterStart', async () => {
      await indexRepository.loadReadyStates();
    });
  }
}
