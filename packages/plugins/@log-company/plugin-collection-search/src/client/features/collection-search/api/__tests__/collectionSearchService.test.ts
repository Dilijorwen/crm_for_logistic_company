/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { unwrapSearchResponse, type CollectionSearchResponse } from '../collectionSearchService';

const result: CollectionSearchResponse = {
  collection: {
    name: 'customs_processes',
    title: 'Таможенное оформление',
  },
  rows: [
    {
      recordKey: { id: 377874066243584 },
      title: '1 - 33333 с ЮРА',
      matches: [
        {
          fieldName: 'car_number',
          fieldTitle: 'Номер машины',
          value: '33333',
          rawValue: '33333',
          score: 10,
        },
      ],
      score: 10,
    },
  ],
  hasNext: false,
};

describe('unwrapSearchResponse', () => {
  it('accepts the NocoBase list response produced by the action middleware', () => {
    expect(
      unwrapSearchResponse({
        data: {
          data: result.rows,
          meta: {
            collection: result.collection,
            hasNext: result.hasNext,
          },
        },
      }),
    ).toEqual(result);
  });

  it('keeps pagination metadata from a NocoBase list response', () => {
    expect(
      unwrapSearchResponse({
        data: result.rows,
        meta: {
          collection: result.collection,
          hasNext: true,
          nextCursor: 'cursor-2',
        },
      }),
    ).toEqual({
      ...result,
      hasNext: true,
      nextCursor: 'cursor-2',
    });
  });

  it('accepts a standard NocoBase data wrapper', () => {
    expect(unwrapSearchResponse({ data: { data: result } })).toEqual(result);
  });

  it('accepts a single data wrapper', () => {
    expect(unwrapSearchResponse({ data: result })).toEqual(result);
  });

  it('accepts an already unwrapped API response', () => {
    expect(unwrapSearchResponse(result)).toEqual(result);
  });

  it('rejects an invalid response', () => {
    expect(() => unwrapSearchResponse({ data: { rows: [] } })).toThrow(
      'The server returned an invalid collection search response.',
    );
  });
});
