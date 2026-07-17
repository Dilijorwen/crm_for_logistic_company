import { Migration } from '@nocobase/server';

interface CollectionsMetadataRepository {
  findOne(options: { filter: { name: string } }): Promise<unknown>;
  db2cm?(name: string): Promise<void>;
}

export default class extends Migration {
  on = 'afterLoad';

  async up() {
    for (const name of ['process_document_folders', 'process_documents']) {
      const collection = this.db.getCollection(name);
      if (collection) {
        await collection.sync({ alter: { drop: false } });
      }

      const collectionsRepository = this.db.getRepository('collections') as unknown as CollectionsMetadataRepository;
      const exists = await collectionsRepository.findOne({ filter: { name } });
      if (!exists && collection && collectionsRepository.db2cm) {
        await collectionsRepository.db2cm(name);
      }
    }
  }

  async down() {
    // Keep document metadata and stored data.
  }
}
