/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DataTypes } from '@nocobase/database';
import { Migration } from '@nocobase/server';
import { permitDocumentMarkingField } from '../collections/permitDocuments';
import { ensurePermitDocumentMarkingFields } from '../infrastructure/metadata/EnsurePermitDocumentEditFields';

const COLLECTION_NAME = 'permit_documents';

export default class AddPermitDocumentMarking extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const queryInterface = this.db.sequelize.getQueryInterface();
    const { name, ...options } = permitDocumentMarkingField;
    const columns = await queryInterface.describeTable(COLLECTION_NAME);

    await this.db.sequelize.transaction(async (transaction) => {
      if (!columns[name]) {
        await queryInterface.addColumn(
          COLLECTION_NAME,
          name,
          { type: DataTypes.TEXT, allowNull: true },
          { transaction },
        );
      }

      const fields = this.db.getRepository('fields');
      const existing = await fields.findOne({ filter: { collectionName: COLLECTION_NAME, name }, transaction });
      if (!existing) {
        await fields.create({ values: { collectionName: COLLECTION_NAME, name, ...options }, transaction });
      }

      await ensurePermitDocumentMarkingFields(this.db, transaction);
    });
  }
}
