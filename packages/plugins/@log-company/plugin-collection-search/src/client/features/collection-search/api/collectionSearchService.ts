/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { APIClient } from '@nocobase/client';

export interface CollectionSearchMatch {
  fieldName: string;
  fieldTitle: string;
  value: string;
  rawValue: string | number | boolean | null;
  score: number;
}

export interface CollectionSearchRow {
  recordKey: Record<string, string | number | boolean | null>;
  title: string;
  matches: CollectionSearchMatch[];
  score: number;
}

export interface CollectionSearchResponse {
  collection: {
    name: string;
    title: string;
  };
  rows: CollectionSearchRow[];
  nextCursor?: string;
  hasNext: boolean;
}

function isSearchResponse(value: unknown): value is CollectionSearchResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const response = value as Partial<CollectionSearchResponse>;
  return Boolean(
    response.collection &&
      typeof response.collection.name === 'string' &&
      typeof response.collection.title === 'string' &&
      Array.isArray(response.rows) &&
      typeof response.hasNext === 'boolean',
  );
}

function responseData(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return (value as { data?: unknown }).data;
}

function fromNocoBaseListResponse(value: unknown): CollectionSearchResponse | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const response = value as {
    data?: unknown;
    meta?: {
      collection?: unknown;
      hasNext?: unknown;
      nextCursor?: unknown;
    };
  };
  const normalized = {
    collection: response.meta?.collection,
    rows: response.data,
    hasNext: response.meta?.hasNext,
    nextCursor: typeof response.meta?.nextCursor === 'string' ? response.meta.nextCursor : undefined,
  };
  return isSearchResponse(normalized) ? normalized : undefined;
}

export function unwrapSearchResponse(value: unknown): CollectionSearchResponse {
  const firstLevel = responseData(value);
  const candidates = [firstLevel, responseData(firstLevel), value];
  for (const candidate of candidates) {
    if (isSearchResponse(candidate)) {
      return candidate;
    }
    const normalized = fromNocoBaseListResponse(candidate);
    if (normalized) {
      return normalized;
    }
  }
  throw new Error('The server returned an invalid collection search response.');
}

export async function searchCurrentCollection(
  api: APIClient,
  input: {
    dataSourceKey: string;
    collectionName: string;
    term: string;
    cursor?: string;
    pageSize?: number;
  },
): Promise<CollectionSearchResponse> {
  const response: unknown = await api
    .resource(input.collectionName, null, {
      'x-data-source': input.dataSourceKey,
    })
    .searchCurrentCollection({
      term: input.term,
      cursor: input.cursor,
      pageSize: input.pageSize,
    });
  return unwrapSearchResponse(response);
}
