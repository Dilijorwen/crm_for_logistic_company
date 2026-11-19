/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import path from 'path';
import { Plugin } from '@nocobase/server';
import { ProcessDocumentsModule } from './composition/ProcessDocumentsModule';
import sectionRules, { documentSectionRulesCollection } from './collections/processDocumentSectionRules';

export class PluginProcessDocumentsServer extends Plugin {
  async load(): Promise<void> {
    const collectionsRepository = this.db.getRepository('collections');
    const [foldersCollection, documentsCollection] = await Promise.all([
      collectionsRepository.findOne({ filter: { name: 'process_document_folders' } }),
      collectionsRepository.findOne({ filter: { name: 'process_documents' } }),
    ]);

    if (!foldersCollection || !documentsCollection) {
      await this.importCollections(path.resolve(__dirname, 'collections'));
    }
    if (!this.db.getCollection(documentSectionRulesCollection)) this.db.collection(sectionRules);

    this.db.addMigrations({
      namespace: 'process-documents',
      directory: path.resolve(__dirname, 'migrations'),
      context: { plugin: this },
    });

    await new ProcessDocumentsModule(this).initialize();
  }
}

export default PluginProcessDocumentsServer;
