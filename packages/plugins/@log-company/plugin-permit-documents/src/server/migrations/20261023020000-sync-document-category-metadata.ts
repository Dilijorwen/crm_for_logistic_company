/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import permitDocuments from '../collections/permitDocuments';
import { permitDocumentCompanyField } from '../infrastructure/metadata/permitDocumentAssociationFields';
import AddDocumentCategories from './20261023010000-add-document-categories';

export default class SyncDocumentCategoryMetadata extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await new AddDocumentCategories({
      ...this.context,
      db: this.db,
      sequelize: this.db.sequelize,
      queryInterface: this.db.sequelize.getQueryInterface(),
    }).up();
    await this.db.sequelize.transaction(async (transaction) => {
      const repository = this.db.getRepository('fields');
      for (const definition of [
        ...(permitDocuments.fields ?? []),
        {
          ...permitDocumentCompanyField,
          uiSchema: { ...permitDocumentCompanyField.uiSchema, 'x-use-component-props': 'usePermitDocumentFieldProps' },
        },
      ]) {
        const { name, type, interface: fieldInterface, ...options } = definition;
        const existing = await repository.findOne({
          filter: { collectionName: 'permit_documents', name },
          transaction,
        });
        if (existing) await existing.update({ type, interface: fieldInterface, options }, { transaction });
        else
          await repository.create({
            values: { collectionName: 'permit_documents', name, type, interface: fieldInterface, ...options },
            transaction,
          });
      }
    });
  }
}
