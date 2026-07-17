import { Migration } from '@nocobase/server';

const PROCESS_COLLECTION = 'customs_processes';
const COMMENTS_COLLECTION = 'process_comments';
const PROCESS_COMMENTS_FIELD = 'comments';
const COMMENT_PROCESS_FIELD = 'process';

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await this.db.sequelize.query(
      `
        update fields
        set options = jsonb_set(coalesce(options::jsonb, '{}'::jsonb), '{onDelete}', '"CASCADE"'::jsonb, true)::json
        where ("collectionName" = :processCollection and name = :processCommentsField)
           or ("collectionName" = :commentsCollection and name = :commentProcessField)
      `,
      {
        replacements: {
          processCollection: PROCESS_COLLECTION,
          commentsCollection: COMMENTS_COLLECTION,
          processCommentsField: PROCESS_COMMENTS_FIELD,
          commentProcessField: COMMENT_PROCESS_FIELD,
        },
      },
    );
  }

  async down(): Promise<void> {
    await this.db.sequelize.query(
      `
        update fields
        set options = (coalesce(options::jsonb, '{}'::jsonb) - 'onDelete')::json
        where ("collectionName" = :processCollection and name = :processCommentsField)
           or ("collectionName" = :commentsCollection and name = :commentProcessField)
      `,
      {
        replacements: {
          processCollection: PROCESS_COLLECTION,
          commentsCollection: COMMENTS_COLLECTION,
          processCommentsField: PROCESS_COMMENTS_FIELD,
          commentProcessField: COMMENT_PROCESS_FIELD,
        },
      },
    );
  }
}
