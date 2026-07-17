import { Migration } from '@nocobase/server';

export default class extends Migration {
  on = 'afterLoad';

  async up() {
    await this.db.sequelize.query(`
      update fields
      set options = jsonb_set(coalesce(options::jsonb, '{}'::jsonb), '{targetKey}', '"id"'::jsonb, true)::json
      where "collectionName" in ('process_document_folders', 'process_documents')
        and name in ('process', 'parent_folder', 'folder')
    `);
  }

  async down() {
    // No-op. The relation target key defaults to the target primary key.
  }
}
