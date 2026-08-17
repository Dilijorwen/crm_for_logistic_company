/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export type CollectionSearchErrorCode =
  | 'SEARCH_TERM_TOO_SHORT'
  | 'SEARCH_TERM_TOO_LONG'
  | 'COLLECTION_NOT_FOUND'
  | 'NO_SEARCHABLE_FIELDS'
  | 'INVALID_PAGE_SIZE';

export class CollectionSearchError extends Error {
  constructor(
    public readonly code: CollectionSearchErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CollectionSearchError';
  }
}
