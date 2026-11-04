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

export default class AddDocumentCategories extends Migration {
  on = 'beforeLoad';

  async up(): Promise<void> {
    const queryInterface = this.db.sequelize.getQueryInterface();
    if (!(await queryInterface.tableExists('permit_documents'))) return;
    await this.db.sequelize.transaction(async (transaction) => {
      const columns = await queryInterface.describeTable('permit_documents');
      const definitions = {
        category: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ordinary' },
        rental_from: { type: DataTypes.DATEONLY, allowNull: true },
        rental_until: { type: DataTypes.DATEONLY, allowNull: true },
        period_from: { type: DataTypes.DATEONLY, allowNull: true },
        period_until: { type: DataTypes.DATEONLY, allowNull: true },
        rental_status: { type: DataTypes.STRING, allowNull: true },
        manufacturer_name: { type: DataTypes.TEXT, allowNull: true },
        manufacturer_address: { type: DataTypes.TEXT, allowNull: true },
      };
      for (const [name, definition] of Object.entries(definitions)) {
        if (!columns[name]) await queryInterface.addColumn('permit_documents', name, definition, { transaction });
      }
      await this.db.sequelize.query(
        `update permit_documents set
        period_from = case when category = 'rented' then rental_from else valid_from end,
        period_until = case when category = 'rented' then rental_until else valid_until end`,
        { transaction },
      );
      const indexes = await queryInterface.showIndex('permit_documents', { transaction });
      if (
        !(indexes as Array<{ name: string }>).some((index) => index.name === 'permit_documents_category_period_idx')
      ) {
        await queryInterface.addIndex('permit_documents', ['category', 'period_until', 'period_from'], {
          name: 'permit_documents_category_period_idx',
          transaction,
        });
      }
      if (this.db.sequelize.getDialect() === 'postgres') {
        await this.db.sequelize.query(
          `alter table permit_documents
          drop constraint if exists permit_documents_sync_status_check,
          drop constraint if exists permit_documents_category_check;
          alter table permit_documents add constraint permit_documents_sync_status_check
            check (sync_status in ('PENDING', 'SUCCESS', 'NOT_FOUND', 'ERROR', 'NOT_REQUIRED'));
          alter table permit_documents add constraint permit_documents_category_check check (
            category in ('ordinary', 'rented', 'voluntary')
            and ((category = 'voluntary') = (sync_status = 'NOT_REQUIRED'))
            and (category <> 'rented' or (company_id is null and rental_from is not null
              and rental_until is not null and rental_until >= rental_from))
            and (category = 'rented' or (rental_from is null and rental_until is null))
            and (category <> 'voluntary' or (document_type = 'certificate_of_conformity'
              and related_document_id is null and company_id is not null
              and valid_from is not null and valid_until is not null and valid_until >= valid_from
              and nullif(btrim(product_information), '') is not null
              and nullif(btrim(manufacturer_name), '') is not null
              and nullif(btrim(manufacturer_address), '') is not null))
          )`,
          { transaction },
        );
      }
    });
  }
}
