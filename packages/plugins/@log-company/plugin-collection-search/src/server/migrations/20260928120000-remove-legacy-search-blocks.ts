/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import { QueryTypes } from 'sequelize';

interface FlowModelTreeRepository {
  remove(uid: string): Promise<void>;
}

interface SqlQueryGenerator {
  quoteTable(tableName: unknown): string;
  quoteIdentifier(identifier: string): string;
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const collection = this.db.getCollection('flowModels');
    if (!collection) {
      return;
    }
    const queryGenerator = this.db.sequelize.getQueryInterface().queryGenerator as unknown as SqlQueryGenerator;
    const tableName = queryGenerator.quoteTable(collection.model.getTableName());
    const uidColumn = queryGenerator.quoteIdentifier(collection.getField('uid').columnName());
    const optionsColumn = queryGenerator.quoteIdentifier(collection.getField('options').columnName());
    const rows = await this.db.sequelize.query<{ uid: string }>(
      `SELECT ${uidColumn} AS "uid" FROM ${tableName} WHERE ${optionsColumn}->>'use' = :modelName`,
      {
        replacements: { modelName: 'CollectionSearchBlockModel' },
        type: QueryTypes.SELECT,
      },
    );
    const repository = collection.repository as unknown as FlowModelTreeRepository;
    for (const row of rows) {
      await repository.remove(row.uid);
    }
  }
}
