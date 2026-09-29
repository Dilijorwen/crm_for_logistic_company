/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { normalizeSearchTerm } from '../domain/search/SearchDocument';
import { CollectionSearchError } from '../domain/search/SearchErrors';
import type { CollectionSearchGateway } from './ports/CollectionSearchGateway';

export interface CollectionSearchPlan {
  term: string;
  dataSourceKey: string;
  collectionName: string;
  keyFields: string[];
  searchableFieldNames: string[];
}

export class SearchCurrentCollection {
  constructor(private readonly gateway: CollectionSearchGateway) {}

  async execute(input: {
    term: unknown;
    permittedFieldNames?: string[];
    requestedFieldNames?: string[];
  }): Promise<CollectionSearchPlan> {
    const term = normalizeSearchTerm(input.term);
    const descriptor = await this.gateway.describeCurrentCollection();
    if (!descriptor) {
      throw new CollectionSearchError('COLLECTION_NOT_FOUND', 'Current collection was not found.');
    }

    const permittedFields = input.permittedFieldNames
      ? new Set(input.permittedFieldNames.map((fieldName) => fieldName.split('.')[0]))
      : null;
    const requestedFields = input.requestedFieldNames ? new Set(input.requestedFieldNames) : null;
    const searchableFieldNames = descriptor.searchableFields
      .map((field) => field.name)
      .filter(
        (fieldName) =>
          (!permittedFields || permittedFields.has(fieldName)) && (!requestedFields || requestedFields.has(fieldName)),
      );
    if (!searchableFieldNames.length) {
      throw new CollectionSearchError('NO_SEARCHABLE_FIELDS', 'Current collection has no searchable fields.');
    }

    await this.gateway.ensureIndex(descriptor);

    return {
      term,
      dataSourceKey: descriptor.dataSourceKey,
      collectionName: descriptor.collectionName,
      keyFields: descriptor.keyFields,
      searchableFieldNames,
    };
  }
}
