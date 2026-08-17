/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import {
  findSearchMatches,
  normalizePageSize,
  normalizeSearchTerm,
  type SearchMatch,
} from '../domain/search/SearchDocument';
import { CollectionSearchError } from '../domain/search/SearchErrors';
import type {
  AccessibleSearchRecord,
  CollectionSearchDescriptor,
  CollectionSearchGateway,
  IndexedSearchCandidate,
  RecordKeyValues,
} from './ports/CollectionSearchGateway';

const CANDIDATE_BATCH_SIZE = 200;
const MAX_CANDIDATES_PER_REQUEST = 2_000;

export interface SearchCollectionResultItem {
  recordKey: RecordKeyValues;
  title: string;
  matches: SearchMatch[];
  score: number;
}

export interface SearchCollectionResult {
  collection: {
    name: string;
    title: string;
  };
  rows: SearchCollectionResultItem[];
  nextCursor?: string;
  hasNext: boolean;
}

function serializeKey(values: RecordKeyValues): string {
  return JSON.stringify(
    Object.keys(values)
      .sort()
      .reduce<RecordKeyValues>((result, key) => {
        result[key] = values[key];
        return result;
      }, {}),
  );
}

function resultTitle(descriptor: CollectionSearchDescriptor, record: AccessibleSearchRecord): string {
  const titleValue = descriptor.titleField ? record.values[descriptor.titleField] : undefined;
  if (titleValue !== undefined && titleValue !== null && String(titleValue).trim()) {
    return String(titleValue);
  }
  return Object.values(record.keyValues)
    .filter((value) => value !== null && value !== undefined)
    .map(String)
    .join(' / ');
}

function permittedFields(descriptor: CollectionSearchDescriptor) {
  if (!descriptor.permittedFieldNames) {
    return descriptor.searchableFields;
  }
  const permitted = new Set(descriptor.permittedFieldNames);
  return descriptor.searchableFields.filter((field) => permitted.has(field.name));
}

export class SearchCurrentCollection {
  constructor(private readonly gateway: CollectionSearchGateway) {}

  async execute(input: { term: unknown; cursor?: unknown; pageSize?: unknown }): Promise<SearchCollectionResult> {
    const term = normalizeSearchTerm(input.term);
    const pageSize = normalizePageSize(input.pageSize);
    const cursor = typeof input.cursor === 'string' && input.cursor ? input.cursor : undefined;
    const descriptor = await this.gateway.describeCurrentCollection();
    if (!descriptor) {
      throw new CollectionSearchError('COLLECTION_NOT_FOUND', 'Current collection was not found.');
    }
    const fields = permittedFields(descriptor);
    if (!fields.length) {
      throw new CollectionSearchError('NO_SEARCHABLE_FIELDS', 'Current collection has no searchable fields.');
    }

    await this.gateway.ensureIndex(descriptor);

    const rows: SearchCollectionResultItem[] = [];
    let scannedCandidates = 0;
    let scanCursor = cursor;
    let hasNext = false;

    while (rows.length < pageSize && scannedCandidates < MAX_CANDIDATES_PER_REQUEST) {
      const candidates = await this.gateway.findCandidates({
        descriptor,
        term,
        cursor: scanCursor,
        limit: Math.min(CANDIDATE_BATCH_SIZE, MAX_CANDIDATES_PER_REQUEST - scannedCandidates),
      });
      if (!candidates.length) {
        hasNext = false;
        break;
      }

      const records = await this.gateway.findAccessibleRecords({ descriptor, candidates });
      const recordsByKey = new Map(records.map((record) => [serializeKey(record.keyValues), record]));
      for (const candidate of candidates) {
        scannedCandidates += 1;
        scanCursor = candidate.cursor;
        const record = recordsByKey.get(serializeKey(candidate.keyValues));
        if (!record) {
          continue;
        }
        const matches = findSearchMatches(record.values, fields, term);
        if (!matches.length) {
          continue;
        }
        rows.push({
          recordKey: record.keyValues,
          title: resultTitle(descriptor, record),
          matches,
          score: matches[0].score,
        });
        if (rows.length === pageSize) {
          hasNext = true;
          break;
        }
      }

      if (rows.length === pageSize) {
        break;
      }
      if (candidates.length < CANDIDATE_BATCH_SIZE) {
        hasNext = false;
        break;
      }
      hasNext = true;
    }

    rows.sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));
    return {
      collection: {
        name: descriptor.collectionName,
        title: descriptor.collectionTitle,
      },
      rows,
      nextCursor: hasNext ? scanCursor : undefined,
      hasNext,
    };
  }
}
