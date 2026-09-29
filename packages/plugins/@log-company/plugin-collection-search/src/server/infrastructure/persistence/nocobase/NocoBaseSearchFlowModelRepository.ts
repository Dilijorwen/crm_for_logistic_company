/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database, Model } from '@nocobase/database';
import { COLLECTION_SEARCH_ACTION_MODEL } from '../../../application/AuthorizeSearchConfigurationChange';
import type { SearchFlowModelRepository } from '../../../application/ports/SearchFlowModelRepository';

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export class NocoBaseSearchFlowModelRepository implements SearchFlowModelRepository {
  constructor(private readonly database: Database) {}

  async containsSearchAction(modelUids: string[]): Promise<boolean> {
    if (!modelUids.length || !this.database.getCollection('flowModels')) {
      return false;
    }
    const uniqueModelUids = Array.from(new Set(modelUids));
    const treePathCollection = this.database.getCollection('flowModelTreePath');
    if (treePathCollection) {
      const treePaths = await this.database.getRepository('flowModelTreePath').find({
        filter: { 'ancestor.$in': uniqueModelUids },
        fields: ['descendant'],
      });
      for (const treePath of treePaths) {
        const descendant = treePath.get('descendant');
        if (typeof descendant === 'string') {
          uniqueModelUids.push(descendant);
        }
      }
    }
    const models = await this.database.getRepository('flowModels').find({
      filter: { 'uid.$in': Array.from(new Set(uniqueModelUids)) },
      fields: ['uid', 'options'],
    });
    return models.some((model: Model) => asRecord(model.toJSON().options).use === COLLECTION_SEARCH_ACTION_MODEL);
  }
}
