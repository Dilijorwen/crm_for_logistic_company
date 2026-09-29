/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Collection, Database, Model, Transaction } from '@nocobase/database';
import type { WhereOptions } from 'sequelize';
import {
  type DependentSourceRecord,
  NocoBaseSearchIndexRepository,
  serializeRecordKey,
} from '../../infrastructure/persistence/nocobase/NocoBaseSearchIndexRepository';

interface ModelEventOptions {
  transaction?: Transaction;
  collectionSearchDependents?: DependentSourceRecord[];
}

interface BulkModelEventOptions extends ModelEventOptions {
  model?: typeof Model;
  where?: WhereOptions;
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
    database.on('beforeUpdate', async (model: Model, options: ModelEventOptions) => {
      const collection = sourceCollection(database, model);
      if (collection) {
        options.collectionSearchDependents = await this.indexRepository.collectDependentSourceRecords(
          this.dataSource.name,
          collection,
          model,
          options,
        );
      }
    });
    database.on('beforeDestroy', async (model: Model, options: ModelEventOptions) => {
      const collection = sourceCollection(database, model);
      if (collection) {
        options.collectionSearchDependents = await this.indexRepository.collectDependentSourceRecords(
          this.dataSource.name,
          collection,
          model,
          options,
        );
      }
    });
    database.on('afterCreate', async (model: Model, options: ModelEventOptions) => {
      const collection = sourceCollection(database, model);
      if (collection) {
        await this.indexRepository.upsertSourceModel(this.dataSource.name, collection, model, options);
        await this.indexRepository.refreshDependentsOfChangedModel(this.dataSource.name, collection, model, options);
      }
    });
    database.on('afterUpdate', async (model: Model, options: ModelEventOptions) => {
      const collection = sourceCollection(database, model);
      if (collection) {
        await this.indexRepository.upsertSourceModel(this.dataSource.name, collection, model, options);
        const currentDependents = await this.indexRepository.collectDependentSourceRecords(
          this.dataSource.name,
          collection,
          model,
          options,
        );
        await this.indexRepository.refreshDependentSourceRecords(
          this.dataSource.name,
          this.mergeDependents(options.collectionSearchDependents, currentDependents),
          options,
        );
      }
    });
    database.on('afterDestroy', async (model: Model, options: ModelEventOptions) => {
      const collection = sourceCollection(database, model);
      if (collection) {
        await this.indexRepository.removeSourceModel(this.dataSource.name, collection, model, options);
        const currentDependents = await this.indexRepository.collectDependentSourceRecords(
          this.dataSource.name,
          collection,
          model,
          options,
        );
        await this.indexRepository.refreshDependentSourceRecords(
          this.dataSource.name,
          this.mergeDependents(options.collectionSearchDependents, currentDependents),
          options,
        );
      }
    });
    database.on('afterBulkCreate', async (models: Model[], options: BulkModelEventOptions) => {
      const collection = models[0] ? sourceCollection(database, models[0]) : undefined;
      if (!collection) {
        return;
      }
      await this.refreshDependentsForModels(database, collection, models, options);
    });
    database.on('beforeBulkDestroy', async (options: BulkModelEventOptions) => {
      const collection = options.model ? database.getCollection(options.model.name) : undefined;
      if (!collection || !options.where) {
        return;
      }
      const models = await collection.model.findAll({
        where: options.where,
        transaction: options.transaction,
      });
      options.collectionSearchDependents = await this.collectDependentsForModels(collection, models, options);
    });
    database.on('afterBulkDestroy', async (options: BulkModelEventOptions) => {
      await this.indexRepository.refreshDependentSourceRecords(
        this.dataSource.name,
        options.collectionSearchDependents || [],
        options,
      );
    });
  }

  private async collectDependentsForModels(
    collection: Collection,
    models: Model[],
    options: ModelEventOptions,
  ): Promise<DependentSourceRecord[]> {
    let records: DependentSourceRecord[] = [];
    for (const model of models) {
      const current = await this.indexRepository.collectDependentSourceRecords(
        this.dataSource.name,
        collection,
        model,
        options,
      );
      records = this.mergeDependents(records, current);
    }
    return records;
  }

  private async refreshDependentsForModels(
    database: Database,
    collection: Collection,
    models: Model[],
    options: ModelEventOptions,
  ): Promise<void> {
    const records = await this.collectDependentsForModels(collection, models, options);
    await this.indexRepository.refreshDependentSourceRecords(this.dataSource.name, records, {
      transaction: collection.db === database ? options.transaction : undefined,
    });
  }

  private mergeDependents(
    previous: DependentSourceRecord[] | undefined,
    current: DependentSourceRecord[],
  ): DependentSourceRecord[] {
    const merged = new Map<string, DependentSourceRecord>();
    for (const record of [...(previous || []), ...current]) {
      merged.set(`${record.collectionName}:${serializeRecordKey(record.keyValues)}`, record);
    }
    return Array.from(merged.values());
  }
}
