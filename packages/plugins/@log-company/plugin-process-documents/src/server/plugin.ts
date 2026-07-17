import path from 'path';
import { Plugin } from '@nocobase/server';
import { ProcessDocumentsModule } from './composition/ProcessDocumentsModule';

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

    this.db.addMigrations({
      namespace: 'process-documents',
      directory: path.resolve(__dirname, 'migrations'),
      context: { plugin: this },
    });

    await new ProcessDocumentsModule(this).initialize();
  }
}

export default PluginProcessDocumentsServer;
