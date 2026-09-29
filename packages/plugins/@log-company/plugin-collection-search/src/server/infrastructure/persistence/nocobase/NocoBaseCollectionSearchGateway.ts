/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Context } from '@nocobase/actions';
import type { Collection, Database } from '@nocobase/database';
import type {
  CollectionSearchDescriptor,
  CollectionSearchGateway,
} from '../../../application/ports/CollectionSearchGateway';
import { describeCollection, NocoBaseSearchIndexRepository } from './NocoBaseSearchIndexRepository';

interface CurrentRepository {
  collection?: Collection;
}

type SearchContext = Context & {
  getCurrentRepository?: () => CurrentRepository;
};

interface SearchDataSource {
  name: string;
  collectionManager: {
    db?: Database;
  };
}

export class NocoBaseCollectionSearchGateway implements CollectionSearchGateway {
  constructor(
    private readonly context: SearchContext,
    private readonly dataSource: SearchDataSource,
    private readonly indexRepository: NocoBaseSearchIndexRepository,
  ) {}

  async describeCurrentCollection(): Promise<CollectionSearchDescriptor | null> {
    const collection = this.currentCollection();
    if (!collection) {
      return null;
    }
    const descriptor = describeCollection(collection, this.dataSource.name);
    if (!descriptor) {
      return null;
    }
    return descriptor;
  }

  async ensureIndex(descriptor: CollectionSearchDescriptor): Promise<void> {
    const database = this.sourceDatabase();
    const collection = this.currentCollection();
    if (!database || !collection) {
      return;
    }
    await this.indexRepository.ensureSynchronized(descriptor, database, collection);
  }

  private sourceDatabase(): Database | undefined {
    return this.dataSource.collectionManager.db;
  }

  private currentCollection(): Collection | undefined {
    return this.context.getCurrentRepository?.().collection;
  }
}
