/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import { NocoBaseSearchIndexRepository } from '../infrastructure/persistence/nocobase/NocoBaseSearchIndexRepository';
import { CollectionSearchIndexSubscriber } from '../interfaces/hooks/CollectionSearchIndexSubscriber';
import { CollectionSearchController } from '../interfaces/http/CollectionSearchController';

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
    db?: unknown;
  };
}

export class CollectionSearchModule {
  constructor(private readonly plugin: Plugin) {}

  initialize(): void {
    const indexRepository = new NocoBaseSearchIndexRepository(this.plugin);
    const controller = new CollectionSearchController(this.plugin, indexRepository);
    this.plugin.app.dataSourceManager.afterAddDataSource((dataSource) => {
      controller.register(dataSource as unknown as SearchDataSource);
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
