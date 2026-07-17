import { Migration } from '@nocobase/server';

export default class extends Migration {
  on = 'afterLoad';

  async up() {
    await this.db.sequelize.query(`
      delete from fields
      where ("collectionName" = 'process_document_folders' and name in ('process', 'parent_folder'))
         or ("collectionName" = 'process_documents' and name in ('process', 'folder'))
    `);
  }

  async down() {
    // No-op. The module uses explicit FK fields and server-side checks.
  }
}
