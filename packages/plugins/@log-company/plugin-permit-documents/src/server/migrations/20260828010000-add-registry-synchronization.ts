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

const COLLECTIONS = ['permit_documents', 'technical_regulations', 'document_technical_regulations'] as const;

interface CollectionsMetadataRepository {
  findOne(options: { filter: { name: string } }): Promise<unknown>;
  db2cm?(name: string): Promise<void>;
}

interface FieldsMetadataRepository {
  destroy(options: { filter: { collectionName: string; name: string } }): Promise<number>;
}

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const queryInterface = this.db.sequelize.getQueryInterface();
    await this.db.sequelize.transaction(async (transaction) => {
      const columns = await queryInterface.describeTable('permit_documents');
      await queryInterface.changeColumn(
        'permit_documents',
        'valid_from',
        { type: DataTypes.DATEONLY, allowNull: true },
        { transaction },
      );
      await queryInterface.changeColumn(
        'permit_documents',
        'valid_until',
        { type: DataTypes.DATEONLY, allowNull: true },
        { transaction },
      );
      await queryInterface.changeColumn(
        'permit_documents',
        'status',
        { type: DataTypes.STRING, allowNull: true },
        { transaction },
      );
      await this.addColumnIfMissing(columns, 'external_id', { type: DataTypes.STRING, allowNull: true }, transaction);
      await this.addColumnIfMissing(
        columns,
        'external_status',
        { type: DataTypes.STRING, allowNull: true },
        transaction,
      );
      await this.addColumnIfMissing(
        columns,
        'sync_status',
        { type: DataTypes.STRING, allowNull: false, defaultValue: 'PENDING' },
        transaction,
      );
      await this.addColumnIfMissing(columns, 'last_checked_at', { type: DataTypes.DATE, allowNull: true }, transaction);
      await this.addColumnIfMissing(columns, 'last_sync_error', { type: DataTypes.TEXT, allowNull: true }, transaction);
      await this.db.sequelize.query(
        `update permit_documents
         set status = case when status = 'revoked' then 'terminated' else status end,
             sync_status = coalesce(sync_status, 'PENDING')`,
        { transaction },
      );
    });

    for (const collectionName of COLLECTIONS) {
      const collection = this.db.getCollection(collectionName);
      if (!collection) {
        throw new Error(`The ${collectionName} collection is not loaded.`);
      }
      await collection.sync({ alter: { drop: false } });
    }

    await this.enforcePostgresConstraints();
    await this.synchronizeMetadata();
  }

  async down(): Promise<void> {
    if (this.db.sequelize.getDialect() !== 'postgres') {
      return;
    }
    await this.db.sequelize.query(
      `drop index if exists permit_documents_daily_sync_idx;
       drop index if exists permit_documents_external_identity_unique;
       drop index if exists permit_documents_document_identity_unique;
       alter table permit_documents
         drop constraint if exists permit_documents_success_payload_check,
         drop constraint if exists permit_documents_sync_status_check,
         drop constraint if exists permit_documents_status_check;`,
    );
  }

  private async addColumnIfMissing(
    columns: Record<string, unknown>,
    name: string,
    definition: { type: unknown; allowNull: boolean; defaultValue?: string },
    transaction: Transaction,
  ): Promise<void> {
    if (columns[name]) {
      return;
    }
    await this.db.sequelize
      .getQueryInterface()
      .addColumn(
        'permit_documents',
        name,
        definition as Parameters<ReturnType<typeof this.db.sequelize.getQueryInterface>['addColumn']>[2],
        { transaction },
      );
  }

  private async enforcePostgresConstraints(): Promise<void> {
    if (this.db.sequelize.getDialect() !== 'postgres') {
      return;
    }
    await this.db.sequelize.query(
      `do $$
       begin
         if not exists (select 1 from pg_constraint where conname = 'permit_documents_status_check') then
           alter table permit_documents add constraint permit_documents_status_check
             check (status is null or status in ('valid', 'suspended', 'terminated'));
         end if;
         if not exists (select 1 from pg_constraint where conname = 'permit_documents_sync_status_check') then
           alter table permit_documents add constraint permit_documents_sync_status_check
             check (sync_status in ('PENDING', 'SUCCESS', 'NOT_FOUND', 'ERROR'));
         end if;
         if not exists (select 1 from pg_constraint where conname = 'permit_documents_success_payload_check') then
           alter table permit_documents add constraint permit_documents_success_payload_check check (
             sync_status <> 'SUCCESS' or (
               status is not null
               and valid_from is not null
               and nullif(btrim(product_information), '') is not null
               and (
                 (document_type = 'state_registration_certificate' and valid_until is null)
                 or (document_type in ('declaration_of_conformity', 'certificate_of_conformity') and valid_until is not null)
               )
             )
           );
         end if;
       end
       $$;
       create unique index if not exists permit_documents_document_identity_unique
         on permit_documents(document_type, title);
       create unique index if not exists permit_documents_external_identity_unique
         on permit_documents(document_type, external_id) where external_id is not null;
       create index if not exists permit_documents_daily_sync_idx
         on permit_documents(status, sync_status, last_checked_at);
       create unique index if not exists technical_regulations_fsa_id_unique
         on technical_regulations(fsa_id) where fsa_id is not null;
       create unique index if not exists technical_regulations_doc_num_unique
         on technical_regulations(doc_num);
       create index if not exists document_technical_regulations_regulation_idx
         on document_technical_regulations(technical_regulation_id);`,
    );
  }

  private async synchronizeMetadata(): Promise<void> {
    const collections = this.db.getRepository('collections') as unknown as CollectionsMetadataRepository;
    for (const name of COLLECTIONS) {
      if (!(await collections.findOne({ filter: { name } }))) {
        if (!collections.db2cm) {
          throw new Error('The collection metadata synchronization API is unavailable.');
        }
        await collections.db2cm(name);
      } else if (name === 'permit_documents' && collections.db2cm) {
        await collections.db2cm(name);
      }
    }
    const fields = this.db.getRepository('fields') as unknown as FieldsMetadataRepository;
    await fields.destroy({ filter: { collectionName: 'permit_documents', name: 'technical_regulation' } });
  }
}
