/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Collection, Database, Model, Transaction } from '@nocobase/database';
import { NocoBaseSearchIndexRepository } from '../../infrastructure/persistence/nocobase/NocoBaseSearchIndexRepository';

interface ModelEventOptions {
  transaction?: Transaction;
}

interface SearchDataSource {
  name: string;
  collectionManager: {
    db?: Database;
  };
}

function sourceCollection(database: Database, model: Model): Collection | undefined {
  const modelConstructor = model.constructor as typeof Model & { collection?: Collection };
  return modelConstructor.collection || database.getCollection(modelConstructor.name);
}

export class CollectionSearchIndexSubscriber {
  constructor(
    private readonly dataSource: SearchDataSource,
    private readonly indexRepository: NocoBaseSearchIndexRepository,
  ) {}

  register(): void {
    const database = this.dataSource.collectionManager.db;
    if (!database) {
      return;
    }
    database.on('afterCreate', async (model: Model, options: ModelEventOptions) => {
      const collection = sourceCollection(database, model);
      if (collection) {
        await this.indexRepository.upsertSourceModel(this.dataSource.name, collection, model, options);
      }
    });
    database.on('afterUpdate', async (model: Model, options: ModelEventOptions) => {
      const collection = sourceCollection(database, model);
      if (collection) {
        await this.indexRepository.upsertSourceModel(this.dataSource.name, collection, model, options);
      }
    });
    database.on('afterDestroy', async (model: Model, options: ModelEventOptions) => {
      const collection = sourceCollection(database, model);
      if (collection) {
        await this.indexRepository.removeSourceModel(this.dataSource.name, collection, model, options);
      }
    });
  }
}
