/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import { attachmentSearchName, catalogSearchTable } from '../infrastructure/nocobase/catalogSearchSql';

const indexes = [
  { collection: 'process_documents', name: 'lc_process_document_title_trgm', expression: '"title"' },
  { collection: 'attachments', name: 'lc_catalog_attachment_name_trgm', expression: attachmentSearchName },
];

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await this.db.sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    for (const { collection, name, expression } of indexes) {
      const data = this.db.getCollection(collection);
      if (!data) throw new Error(`Коллекция для индекса поиска отсутствует: ${collection}`);
      const table = catalogSearchTable(this.db, data);
      await this.db.sequelize.query(
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${name} ON ${table} USING GIN (${expression} gin_trgm_ops)`,
      );
    }
  }

  async down(): Promise<void> {
    for (const { name } of indexes) {
      await this.db.sequelize.query(`DROP INDEX IF EXISTS ${name}`);
    }
  }
}
