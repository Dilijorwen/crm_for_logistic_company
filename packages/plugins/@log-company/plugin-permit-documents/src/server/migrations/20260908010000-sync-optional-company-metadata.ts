/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DataTypes, type FieldOptions } from '@nocobase/database';
import { Migration } from '@nocobase/server';
import { permitDocumentFields } from '../collections/permitDocuments';
import { permitDocumentCompanyField } from '../infrastructure/metadata/permitDocumentAssociationFields';

const PERMIT_DOCUMENTS_COLLECTION = 'permit_documents';
const COMPANY_FOREIGN_KEY = 'company_id';

interface FieldMetadataModel {
  update(values: Record<string, unknown>): Promise<unknown>;
}

interface FieldsMetadataRepository {
  findOne(options: { filter: { collectionName: string; name: string } }): Promise<FieldMetadataModel | null>;
  create(options: { values: Record<string, unknown> }): Promise<unknown>;
}

export default class SyncOptionalCompanyMetadata extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const companyForeignKeyField = permitDocumentFields.find((field) => field.name === COMPANY_FOREIGN_KEY);
    if (!companyForeignKeyField) {
      throw new Error('The permit_documents.company_id field definition does not exist.');
    }

    const queryInterface = this.db.sequelize.getQueryInterface();
    const columns = await queryInterface.describeTable(PERMIT_DOCUMENTS_COLLECTION);
    if (!columns[COMPANY_FOREIGN_KEY]) {
      throw new Error('The permit_documents.company_id column does not exist.');
    }
    await queryInterface.changeColumn(PERMIT_DOCUMENTS_COLLECTION, COMPANY_FOREIGN_KEY, {
      type: DataTypes.BIGINT,
      allowNull: true,
    });

    const repository = this.db.getRepository('fields') as unknown as FieldsMetadataRepository;
    await this.upsertFieldMetadata(repository, companyForeignKeyField);
    await this.upsertFieldMetadata(repository, permitDocumentCompanyField);
  }

  async down(): Promise<void> {
    // Optional metadata is retained because existing documents may not have a company.
  }

  private async upsertFieldMetadata(repository: FieldsMetadataRepository, field: FieldOptions): Promise<void> {
    const { name, type, interface: fieldInterface, ...options } = field;
    const fieldName = String(name);
    const existing = await repository.findOne({
      filter: { collectionName: PERMIT_DOCUMENTS_COLLECTION, name: fieldName },
    });
    if (!existing) {
      await repository.create({
        values: {
          collectionName: PERMIT_DOCUMENTS_COLLECTION,
          name: fieldName,
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
