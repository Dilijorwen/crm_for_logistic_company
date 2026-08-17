/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Context } from '@nocobase/actions';
import type { Collection, Database, Model } from '@nocobase/database';
import type {
  AccessibleSearchRecord,
  CollectionSearchDescriptor,
  CollectionSearchGateway,
  IndexedSearchCandidate,
} from '../../../application/ports/CollectionSearchGateway';
import { describeCollection, NocoBaseSearchIndexRepository, recordKeyValues } from './NocoBaseSearchIndexRepository';

interface CurrentRepository {
  collection?: Collection;
}

interface PermissionParams {
  fields?: string[];
  filter?: unknown;
}

type SearchContext = Context & {
  getCurrentRepository?: () => CurrentRepository;
  permission?: {
    parsedParams?: PermissionParams;
  };
};

interface SearchDataSource {
  name: string;
  collectionManager: {
    db?: Database;
  };
}

function modelValues(model: Model): Record<string, unknown> {
  const json = model.toJSON();
  return json !== null && typeof json === 'object' && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
}

export class NocoBaseCollectionSearchGateway implements CollectionSearchGateway {
  private descriptor?: CollectionSearchDescriptor;

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
    const permittedFields = this.context.permission?.parsedParams?.fields;
    descriptor.permittedFieldNames = Array.isArray(permittedFields) ? permittedFields.map(String) : undefined;
    this.descriptor = descriptor;
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

  async findCandidates(input: {
    descriptor: CollectionSearchDescriptor;
    term: string;
    cursor?: string;
    limit: number;
  }): Promise<IndexedSearchCandidate[]> {
    return this.indexRepository.findCandidates(input);
  }

  async findAccessibleRecords(input: {
    descriptor: CollectionSearchDescriptor;
    candidates: IndexedSearchCandidate[];
  }): Promise<AccessibleSearchRecord[]> {
    const database = this.sourceDatabase();
    if (!database || !input.candidates.length) {
      return [];
    }
    const permitted = input.descriptor.permittedFieldNames ? new Set(input.descriptor.permittedFieldNames) : undefined;
    const fields = Array.from(
      new Set([
        ...input.descriptor.keyFields,
        ...input.descriptor.searchableFields
          .map((field) => field.name)
          .filter((fieldName) => !permitted || permitted.has(fieldName)),
        ...(input.descriptor.titleField && (!permitted || permitted.has(input.descriptor.titleField))
          ? [input.descriptor.titleField]
          : []),
      ]),
    );
    const candidateFilter = {
      $or: input.candidates.map((candidate) => candidate.keyValues),
    };
    const accessFilter = this.context.permission?.parsedParams?.filter;
    const filter = accessFilter ? { $and: [accessFilter, candidateFilter] } : candidateFilter;
    const models = await database.getRepository(input.descriptor.collectionName).find({
      filter,
      fields,
      context: this.context,
    });
    return models
      .map((model: Model) => {
        const values = modelValues(model);
        const keys = recordKeyValues(values, input.descriptor.keyFields);
        return keys
          ? {
              keyValues: keys,
              values,
            }
          : null;
      })
      .filter((record): record is AccessibleSearchRecord => Boolean(record));
  }

  private sourceDatabase(): Database | undefined {
    return this.dataSource.collectionManager.db;
  }

  private currentCollection(): Collection | undefined {
    return this.context.getCurrentRepository?.().collection;
  }
}
