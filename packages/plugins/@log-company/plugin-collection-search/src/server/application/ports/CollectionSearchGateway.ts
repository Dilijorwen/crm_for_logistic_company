/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { SearchableField } from '../../domain/search/SearchDocument';

export type RecordKeyValues = Record<string, string | number | boolean | null>;

export interface CollectionSearchDescriptor {
  dataSourceKey: string;
  collectionName: string;
  collectionTitle: string;
  keyFields: string[];
  titleField?: string;
  searchableFields: SearchableField[];
  permittedFieldNames?: string[];
}

export interface IndexedSearchCandidate {
  cursor: string;
  keyValues: RecordKeyValues;
}

export interface AccessibleSearchRecord {
  keyValues: RecordKeyValues;
  values: Record<string, unknown>;
}

export interface CollectionSearchGateway {
  describeCurrentCollection(): Promise<CollectionSearchDescriptor | null>;
  ensureIndex(descriptor: CollectionSearchDescriptor): Promise<void>;
  findCandidates(input: {
    descriptor: CollectionSearchDescriptor;
    term: string;
    cursor?: string;
    limit: number;
  }): Promise<IndexedSearchCandidate[]>;
  findAccessibleRecords(input: {
    descriptor: CollectionSearchDescriptor;
    candidates: IndexedSearchCandidate[];
  }): Promise<AccessibleSearchRecord[]>;
}
