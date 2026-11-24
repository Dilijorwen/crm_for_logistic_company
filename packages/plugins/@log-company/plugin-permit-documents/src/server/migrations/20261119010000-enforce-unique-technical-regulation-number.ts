/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';

const collectionName = 'technical_regulations';
const fieldName = 'doc_num';

export default class EnforceUniqueTechnicalRegulationNumber extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const table = this.db.getCollection(collectionName).getTableNameWithSchema();
    const query = this.db.sequelize.getQueryInterface();

    await this.db.sequelize.transaction(async (transaction) => {
      const indexes = (await query.showIndex(table, { transaction })) as Array<{
        unique: boolean;
        fields: { attribute: string }[];
        definition?: string;
        partial?: number;
      }>;
      const hasUniqueNumber = indexes.some(
        (index) =>
          index.unique &&
          !index.partial &&
          !index.definition?.includes(' WHERE ') &&
          index.fields.length === 1 &&
          index.fields[0].attribute === fieldName,
      );
      if (!hasUniqueNumber) {
        await query.addIndex(table, [fieldName], {
          name: 'technical_regulations_doc_num_uk',
          unique: true,
          transaction,
        });
      }

      const field = await this.db.getRepository('fields').findOne({
        filter: { collectionName, name: fieldName },
        transaction,
      });
      if (field && !field.get('unique')) {
        await field.update({ unique: true }, { transaction });
      }
    });
  }
}
