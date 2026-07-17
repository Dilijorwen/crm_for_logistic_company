import { Migration } from '@nocobase/server';

const DRAFT_FIELD_OPTIONS = {
  uiSchema: {
    type: 'string',
    title: 'Черновик процесса',
    'x-component': 'Input',
    'x-read-pretty': true,
  },
};

export default class extends Migration {
  on = 'afterLoad';

  async up() {
    await this.db.sequelize.query(`
      ALTER TABLE process_document_folders
      ADD COLUMN IF NOT EXISTS draft_token varchar(120)
    `);

    await this.db.sequelize.query(`
      ALTER TABLE process_documents
      ADD COLUMN IF NOT EXISTS draft_token varchar(120)
    `);

    await this.db.sequelize.query(`
      ALTER TABLE process_document_folders
      ALTER COLUMN process_id DROP NOT NULL
    `);

    await this.db.sequelize.query(`
      ALTER TABLE process_documents
      ALTER COLUMN process_id DROP NOT NULL
    `);

    await this.db.sequelize.query(`
      CREATE INDEX IF NOT EXISTS process_document_folders_draft_token_idx
      ON process_document_folders(draft_token)
    `);

    await this.db.sequelize.query(`
      CREATE INDEX IF NOT EXISTS process_documents_draft_token_idx
      ON process_documents(draft_token)
    `);

    await this.db.sequelize.query(
      `
        INSERT INTO fields (key, name, type, interface, "collectionName", options, sort)
        VALUES
          (
            'process_document_folders_draft_token',
            'draft_token',
            'string',
            'input',
            'process_document_folders',
            CAST(:options AS json),
            35
          ),
          (
            'process_documents_draft_token',
            'draft_token',
            'string',
            'input',
            'process_documents',
            CAST(:options AS json),
            45
          )
        ON CONFLICT ("collectionName", name)
        DO UPDATE SET
          type = excluded.type,
          interface = excluded.interface,
          options = excluded.options
      `,
      { replacements: { options: JSON.stringify(DRAFT_FIELD_OPTIONS) } },
    );

    await this.db.sequelize.query(`
      UPDATE fields
      SET options = jsonb_set(coalesce(options::jsonb, '{}'::jsonb), '{allowNull}', 'true'::jsonb, true)::json
      WHERE "collectionName" in ('process_document_folders', 'process_documents')
        AND name = 'process_id'
    `);
  }

  async down() {
    // Keep draft columns and metadata to avoid losing files uploaded from create forms.
  }
}
