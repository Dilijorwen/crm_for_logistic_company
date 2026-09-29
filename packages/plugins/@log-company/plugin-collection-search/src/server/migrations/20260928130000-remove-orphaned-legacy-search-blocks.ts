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
    const flowModels = this.db.getCollection('flowModels');
    if (!flowModels) {
      return;
    }
    const queryGenerator = this.db.sequelize.getQueryInterface().queryGenerator as unknown as SqlQueryGenerator;
    const flowModelsTable = queryGenerator.quoteTable(flowModels.model.getTableName());
    const uidColumn = queryGenerator.quoteIdentifier(flowModels.getField('uid').columnName());
    const optionsColumn = queryGenerator.quoteIdentifier(flowModels.getField('options').columnName());
    const rows = await this.db.sequelize.query<{ uid: string }>(
      `SELECT ${uidColumn} AS "uid" FROM ${flowModelsTable} WHERE ${optionsColumn}->>'use' = :modelName`,
      {
        replacements: { modelName: 'CollectionSearchBlockModel' },
        type: QueryTypes.SELECT,
      },
    );
    const repository = flowModels.repository as unknown as FlowModelTreeRepository;
    const treePaths = this.db.getCollection('flowModelTreePath');
    const treePathsTable = treePaths ? queryGenerator.quoteTable(treePaths.model.getTableName()) : null;
    const ancestorColumn = treePaths
      ? queryGenerator.quoteIdentifier(treePaths.getField('ancestor').columnName())
      : null;
    const descendantColumn = treePaths
      ? queryGenerator.quoteIdentifier(treePaths.getField('descendant').columnName())
      : null;

    for (const row of rows) {
      await repository.remove(row.uid);
      if (treePathsTable && ancestorColumn && descendantColumn) {
        await this.db.sequelize.query(
          `DELETE FROM ${treePathsTable} WHERE ${ancestorColumn} = :uid OR ${descendantColumn} = :uid`,
          { replacements: { uid: row.uid } },
        );
      }
      await this.db.sequelize.query(`DELETE FROM ${flowModelsTable} WHERE ${uidColumn} = :uid`, {
        replacements: { uid: row.uid },
      });
    }
  }
}
