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
import { permitDocumentCompanyField } from '../infrastructure/metadata/permitDocumentAssociationFields';

const PERMIT_DOCUMENTS_COLLECTION = 'permit_documents';
const COMPANY_FIELD = 'company';
const COMPANY_FOREIGN_KEY = 'company_id';

interface FieldMetadataModel {
  update(values: Record<string, unknown>): Promise<unknown>;
}

interface FieldsMetadataRepository {
  findOne(options: { filter: { collectionName: string; name: string } }): Promise<FieldMetadataModel | null>;
  create(options: { values: Record<string, unknown> }): Promise<unknown>;
}

export default class MakePermitDocumentCompanyOptional extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const queryInterface = this.db.sequelize.getQueryInterface();
    const columns = await queryInterface.describeTable(PERMIT_DOCUMENTS_COLLECTION);
    if (!columns[COMPANY_FOREIGN_KEY]) {
      throw new Error('The permit_documents.company_id column does not exist.');
    }

    await queryInterface.changeColumn(PERMIT_DOCUMENTS_COLLECTION, COMPANY_FOREIGN_KEY, {
      type: DataTypes.BIGINT,
      allowNull: true,
    });
    await this.updateCompanyFieldMetadata();
  }

  async down(): Promise<void> {
    // The nullable column is retained because documents created without a company cannot safely restore NOT NULL.
  }

  private async updateCompanyFieldMetadata(): Promise<void> {
    const repository = this.db.getRepository('fields') as unknown as FieldsMetadataRepository;
    const existing = await repository.findOne({
      filter: { collectionName: PERMIT_DOCUMENTS_COLLECTION, name: COMPANY_FIELD },
    });
    const { name, type, interface: fieldInterface, ...options } = permitDocumentCompanyField;
    if (!existing) {
      await repository.create({
        values: {
          collectionName: PERMIT_DOCUMENTS_COLLECTION,
          name,
          type,
          interface: fieldInterface,
          ...options,
        },
      });
      return;
    }
    await existing.update({ type, interface: fieldInterface, options });
  }
}
