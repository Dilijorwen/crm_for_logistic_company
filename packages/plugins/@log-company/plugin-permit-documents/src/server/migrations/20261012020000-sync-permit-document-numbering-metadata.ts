/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import { permitDocumentNumberingFields } from '../collections/permitDocuments';
import AddPermitDocumentNumbering from './20261012010000-add-permit-document-numbering';

export default class SyncPermitDocumentNumberingMetadata extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    // Also initializes constraints on a fresh installation, where the table did not exist before load.
    await new AddPermitDocumentNumbering({
      ...this.context,
      db: this.db,
      sequelize: this.db.sequelize,
      queryInterface: this.db.sequelize.getQueryInterface(),
    }).up();
    await this.db.sequelize.transaction(async (transaction) => {
      const fields = this.db.getRepository('fields');
      for (const definition of permitDocumentNumberingFields) {
        const { name, type, interface: fieldInterface, ...options } = definition;
        const existing = await fields.findOne({ filter: { collectionName: 'permit_documents', name }, transaction });
        if (existing) {
          await existing.update({ type, interface: fieldInterface, options }, { transaction });
        } else {
          await fields.create({
            values: { collectionName: 'permit_documents', name, type, interface: fieldInterface, ...options },
            transaction,
          });
        }
      }
    });
  }
}
