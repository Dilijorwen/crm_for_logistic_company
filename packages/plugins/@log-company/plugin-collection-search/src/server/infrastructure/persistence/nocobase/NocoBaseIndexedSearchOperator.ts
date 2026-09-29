/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database } from '@nocobase/database';
import { literal, Op, type ModelStatic } from 'sequelize';
import type { Model } from '@nocobase/database';

const DOCUMENTS_COLLECTION = 'lc_collection_search_documents';
export const COLLECTION_SEARCH_OPERATOR = '$indexedCollectionSearch';

interface IndexedSearchOperatorValue {
  term: string;
  dataSourceKey: string;
  collectionName: string;
  keyFields: string[];
  searchableFieldNames: string[];
}

interface OperatorContext {
  db: Database;
  model: ModelStatic<Model>;
}

interface SqlQueryGenerator {
  quoteTable(tableName: unknown): string;
  quoteIdentifier(identifier: string): string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseValue(value: unknown): IndexedSearchOperatorValue {
  const record = asRecord(value);
  const keyFields = Array.isArray(record.keyFields)
    ? record.keyFields.filter((item): item is string => typeof item === 'string')
    : [];
  const searchableFieldNames = Array.isArray(record.searchableFieldNames)
    ? record.searchableFieldNames.filter((item): item is string => typeof item === 'string')
    : [];
  if (
    typeof record.term !== 'string' ||
    typeof record.dataSourceKey !== 'string' ||
    typeof record.collectionName !== 'string' ||
    !keyFields.length ||
    !searchableFieldNames.length
  ) {
    throw new Error('Invalid indexed collection search filter.');
  }
  return {
    term: record.term,
    dataSourceKey: record.dataSourceKey,
    collectionName: record.collectionName,
    keyFields,
    searchableFieldNames,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\_%]/g, '\\$&');
}

export function createIndexedCollectionSearchOperator(
  searchDatabase: Database,
): (rawValue: unknown, context: OperatorContext) => Record<symbol, unknown> {
  return (rawValue: unknown, context: OperatorContext) => {
    if (context.db.sequelize !== searchDatabase.sequelize) {
      throw new Error('Indexed collection search requires the source collection and search index to share PostgreSQL.');
    }
    const value = parseValue(rawValue);
    const documents = searchDatabase.getCollection(DOCUMENTS_COLLECTION);
    if (!documents) {
      throw new Error('Collection search documents are not available.');
    }

    const queryInterface = context.db.sequelize.getQueryInterface();
    const queryGenerator = queryInterface.queryGenerator as unknown as SqlQueryGenerator;
    const documentsTable = queryGenerator.quoteTable(documents.model.getTableName());
    const alias = queryGenerator.quoteIdentifier('collection_search_document');
    const dataSourceColumn = queryGenerator.quoteIdentifier(documents.getField('dataSourceKey').columnName());
    const collectionColumn = queryGenerator.quoteIdentifier(documents.getField('collectionName').columnName());
    const keyValuesColumn = queryGenerator.quoteIdentifier(documents.getField('keyValues').columnName());
    const fieldValuesColumn = queryGenerator.quoteIdentifier(documents.getField('fieldValues').columnName());
    const searchTextColumn = queryGenerator.quoteIdentifier(documents.getField('searchText').columnName());
    const escape = context.db.sequelize.escape.bind(context.db.sequelize);
    const pattern = `%${escapeLike(value.term)}%`;

    const keyConditions = value.keyFields.map((keyField) => {
      const attribute = context.model.rawAttributes[keyField];
      if (!attribute) {
        throw new Error(`Collection search key field "${keyField}" does not exist.`);
      }
      const sourceColumn = `${queryGenerator.quoteIdentifier(context.model.name)}.${queryGenerator.quoteIdentifier(
        attribute.field || keyField,
      )}`;
      return `${alias}.${keyValuesColumn} ->> ${escape(keyField)} = CAST(${sourceColumn} AS TEXT)`;
    });
    const fieldConditions = value.searchableFieldNames.map(
      (fieldName) => `${alias}.${fieldValuesColumn} -> ${escape(fieldName)} ->> 'searchText' ILIKE ${escape(pattern)}`,
    );

    return {
      [Op.and]: [
        literal(`EXISTS (
          SELECT 1
          FROM ${documentsTable} AS ${alias}
          WHERE ${alias}.${dataSourceColumn} = ${escape(value.dataSourceKey)}
            AND ${alias}.${collectionColumn} = ${escape(value.collectionName)}
            AND ${alias}.${searchTextColumn} ILIKE ${escape(pattern)}
            AND (${fieldConditions.join(' OR ')})
            AND ${keyConditions.join(' AND ')}
        )`),
      ],
    };
  };
}
