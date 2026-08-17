/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';

const DOCUMENTS_COLLECTION = 'lc_collection_search_documents';
const STATES_COLLECTION = 'lc_collection_search_states';
const TRIGRAM_INDEX = 'lc_collection_search_documents_search_text_trgm';

interface SqlQueryGenerator {
  quoteTable(tableName: unknown): string;
  quoteIdentifier(identifier: string): string;
}

function sqlQueryGenerator(value: unknown): SqlQueryGenerator {
  if (!value || typeof value !== 'object') {
    throw new Error('The SQL query generator is unavailable.');
  }
  const generator = value as Partial<SqlQueryGenerator>;
  if (typeof generator.quoteTable !== 'function' || typeof generator.quoteIdentifier !== 'function') {
    throw new Error('The SQL query generator does not support identifier quoting.');
  }
  return generator as SqlQueryGenerator;
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const documents = this.db.getCollection(DOCUMENTS_COLLECTION);
    const states = this.db.getCollection(STATES_COLLECTION);
    if (!documents || !states) {
      throw new Error('Collection search metadata is not loaded.');
    }
    await documents.sync({ alter: { drop: false } });
    await states.sync({ alter: { drop: false } });
    if (!this.db.isPostgresCompatibleDialect()) {
      throw new Error('The collection search plugin requires PostgreSQL with pg_trgm support.');
    }
    await this.db.sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    const queryInterface = this.db.sequelize.getQueryInterface();
    const queryGenerator = sqlQueryGenerator(queryInterface.queryGenerator);
    const tableName = queryGenerator.quoteTable(documents.model.getTableName());
    const columnName = queryGenerator.quoteIdentifier(documents.getField('searchText').columnName());
    const indexName = queryGenerator.quoteIdentifier(TRIGRAM_INDEX);
    await this.db.sequelize.query(
      `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} USING GIN (${columnName} gin_trgm_ops)`,
    );
  }

  async down(): Promise<void> {
    const documents = this.db.getCollection(DOCUMENTS_COLLECTION);
    if (!documents) {
      return;
    }
    const queryInterface = this.db.sequelize.getQueryInterface();
    const indexName = sqlQueryGenerator(queryInterface.queryGenerator).quoteIdentifier(TRIGRAM_INDEX);
    await this.db.sequelize.query(`DROP INDEX IF EXISTS ${indexName}`);
  }
}
