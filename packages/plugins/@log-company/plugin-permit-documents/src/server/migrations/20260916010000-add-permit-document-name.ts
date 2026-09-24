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
import type { Transaction } from 'sequelize';
import { permitDocumentNameField } from '../collections/permitDocuments';
import { isPermitDocumentType, toCalendarDate } from '../domain/permit-document/PermitDocumentPolicy';
import { buildPermitDocumentName } from '../domain/permit-document/RegistryDocument';

const COLLECTION_NAME = 'permit_documents';
const NAME_FIELD = 'name';

interface ExistingPermitDocumentRow {
  id: string | number | bigint;
  title: unknown;
  document_type: unknown;
  valid_from: unknown;
  valid_until: unknown;
}

interface MetadataModel {
  update(values: Record<string, unknown>, options: { transaction: Transaction }): Promise<unknown>;
}

interface FieldsMetadataRepository {
  findOne(options: {
    filter: { collectionName: string; name: string };
    transaction: Transaction;
  }): Promise<MetadataModel | null>;
  create(options: { values: Record<string, unknown>; transaction: Transaction }): Promise<unknown>;
}

interface CollectionsMetadataRepository {
  findOne(options: { filter: { name: string }; transaction: Transaction }): Promise<MetadataModel | null>;
}

export default class AddPermitDocumentName extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const queryInterface = this.db.sequelize.getQueryInterface();
    const columns = await queryInterface.describeTable(COLLECTION_NAME);

    await this.db.sequelize.transaction(async (transaction) => {
      if (!columns[NAME_FIELD]) {
        await queryInterface.addColumn(
          COLLECTION_NAME,
          NAME_FIELD,
          { type: DataTypes.STRING(300), allowNull: true },
          { transaction },
        );
      }

      await this.backfillNames(transaction);
      await queryInterface.changeColumn(
        COLLECTION_NAME,
        NAME_FIELD,
        { type: DataTypes.STRING(300), allowNull: false },
        { transaction },
      );
      await this.updateMetadata(transaction);
    });
  }

  private async backfillNames(transaction: Transaction): Promise<void> {
    const [rows] = (await this.db.sequelize.query(
      `select id, title, document_type, valid_from, valid_until from permit_documents order by id`,
      { transaction },
    )) as unknown as [ExistingPermitDocumentRow[], unknown];

    for (const row of rows) {
      if (typeof row.title !== 'string' || row.title.trim().length === 0) {
        throw new Error(`Permit document ${String(row.id)} has no document number.`);
      }
      const documentNumber = row.title.trim();
      const name = isPermitDocumentType(row.document_type)
        ? buildPermitDocumentName(
            documentNumber,
            row.document_type,
            toCalendarDate(row.valid_from),
            toCalendarDate(row.valid_until),
          )
        : documentNumber;
      await this.db.sequelize.query(`update permit_documents set name = :name where id = :id`, {
        replacements: { id: row.id, name },
        transaction,
      });
    }
  }

  private async updateMetadata(transaction: Transaction): Promise<void> {
    const fields = this.db.getRepository('fields') as unknown as FieldsMetadataRepository;
    const { name, type, interface: fieldInterface, ...options } = permitDocumentNameField;
    const fieldName = String(name);
    const existingField = await fields.findOne({
      filter: { collectionName: COLLECTION_NAME, name: fieldName },
      transaction,
    });
    if (existingField) {
      await existingField.update({ type, interface: fieldInterface, options }, { transaction });
    } else {
      await fields.create({
        values: { collectionName: COLLECTION_NAME, name: fieldName, type, interface: fieldInterface, ...options },
        transaction,
      });
    }

    const collections = this.db.getRepository('collections') as unknown as CollectionsMetadataRepository;
    const collection = await collections.findOne({ filter: { name: COLLECTION_NAME }, transaction });
    if (!collection) {
      throw new Error('The permit_documents collection metadata does not exist.');
    }
    await collection.update({ titleField: NAME_FIELD }, { transaction });
  }
}
