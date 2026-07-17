import { Migration } from '@nocobase/server';

interface CollectionsMetadataRepository {
  findOne(options: { filter: { name: string } }): Promise<unknown>;
  db2cm?(name: string): Promise<void>;
}

export default class extends Migration {
  on = 'afterLoad';

  async up() {
    const processHistory = this.db.getCollection('process_history');
    if (processHistory) {
      await processHistory.sync({
        alter: {
          drop: false,
        },
      });
    }

    const collectionsRepository = this.db.getRepository('collections') as unknown as CollectionsMetadataRepository;
    const exists = await collectionsRepository.findOne({
      filter: {
        name: 'process_history',
      },
    });

    if (!exists && processHistory && collectionsRepository.db2cm) {
      await collectionsRepository.db2cm('process_history');
    }
  }

  async down() {
    // Keep process_history metadata and data.
  }
}
