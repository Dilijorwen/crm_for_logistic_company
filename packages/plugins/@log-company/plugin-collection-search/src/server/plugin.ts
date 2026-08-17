/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import path from 'node:path';
import { Plugin } from '@nocobase/server';
import { CollectionSearchModule } from './composition/CollectionSearchModule';

const REQUIRED_COLLECTIONS = ['lc_collection_search_documents', 'lc_collection_search_states'];

export class PluginCollectionSearchServer extends Plugin {
  async load(): Promise<void> {
    if (REQUIRED_COLLECTIONS.some((name) => !this.db.getCollection(name))) {
      await this.importCollections(path.resolve(__dirname, 'collections'));
    }
    this.db.addMigrations({
      namespace: 'log-company-collection-search',
      directory: path.resolve(__dirname, 'migrations'),
      context: { plugin: this },
    });
    new CollectionSearchModule(this).initialize();
  }
}

export default PluginCollectionSearchServer;
