/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { SearchFlowModelRepository } from './ports/SearchFlowModelRepository';

export const COLLECTION_SEARCH_ACTION_MODEL = 'CollectionSearchActionModel';

export class SearchConfigurationForbiddenError extends Error {
  constructor() {
    super('Only the root role can change collection search configuration.');
    this.name = 'SearchConfigurationForbiddenError';
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function containsSearchAction(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsSearchAction);
  }
  const record = asRecord(value);
  if (record.use === COLLECTION_SEARCH_ACTION_MODEL) {
    return true;
  }
  return Object.values(record).some(containsSearchAction);
}

export class AuthorizeSearchConfigurationChange {
  constructor(private readonly repository: SearchFlowModelRepository) {}

  async execute(input: { roles: string[]; payload?: unknown; modelUids: string[] }): Promise<void> {
    if (input.roles.includes('root')) {
      return;
    }
    if (containsSearchAction(input.payload) || (await this.repository.containsSearchAction(input.modelUids))) {
      throw new SearchConfigurationForbiddenError();
    }
  }
}
