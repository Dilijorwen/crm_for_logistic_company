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

const COLLECTION = 'permit_documents';

export default class AddPermitDocumentNumbering extends Migration {
  on = 'beforeLoad';

  async up(): Promise<void> {
    const queryInterface = this.db.sequelize.getQueryInterface();
    // A fresh installation creates the table during load; the metadata migration completes this phase then.
    if (!(await queryInterface.tableExists(COLLECTION))) return;
    const columns = await queryInterface.describeTable(COLLECTION);
    await this.db.sequelize.transaction(async (transaction) => {
      if (this.db.sequelize.getDialect() === 'postgres') {
        await this.db.sequelize.query('lock table permit_documents in access exclusive mode', { transaction });
      }
      for (const field of ['internal_number', 'related_document_id']) {
        if (!columns[field]) {
          await queryInterface.addColumn(
            COLLECTION,
            field,
            { type: DataTypes.BIGINT, allowNull: true },
            { transaction },
          );
        }
      }
      await this.backfill(transaction);
      await queryInterface.changeColumn(
        COLLECTION,
        'internal_number',
        { type: DataTypes.BIGINT, allowNull: false },
        { transaction },
      );
      const indexes = (await queryInterface.showIndex(COLLECTION, { transaction })) as unknown as Array<{
        name: string;
      }>;
      for (const index of [
        { name: 'permit_documents_internal_number_idx', fields: ['internal_number'], unique: false },
        { name: 'permit_documents_related_document_unique', fields: ['related_document_id'], unique: true },
      ]) {
        if (!indexes.some((existing) => existing.name === index.name)) {
          await queryInterface.addIndex(COLLECTION, index.fields, {
            name: index.name,
            unique: index.unique,
            transaction,
          });
        }
      }
      if (this.db.sequelize.getDialect() === 'postgres') {
        await this.db.sequelize.query(
          `
          do $$ begin
            if not exists (select 1 from pg_constraint where conname = 'permit_documents_internal_number_positive') then
              alter table permit_documents add constraint permit_documents_internal_number_positive check (internal_number > 0);
            end if;
            if not exists (select 1 from pg_constraint where conname = 'permit_documents_related_document_not_self') then
              alter table permit_documents add constraint permit_documents_related_document_not_self check (related_document_id is distinct from id);
            end if;
            if not exists (select 1 from pg_constraint where conname = 'permit_documents_related_document_fk') then
              alter table permit_documents add constraint permit_documents_related_document_fk
                foreign key (related_document_id) references permit_documents(id) on delete set null;
            end if;
          end $$;`,
          { transaction },
        );
      }
    });
  }

  private async backfill(transaction: Transaction): Promise<void> {
    const [rows] = await this.db.sequelize.query(
      'select id, internal_number from permit_documents order by "createdAt" asc, id asc',
      { transaction },
    );
    const documents = rows as Array<{ id: string; internal_number: string | number | null }>;
    const used = new Set(
      documents
        .filter((document) => document.internal_number != null)
        .map((document) => String(document.internal_number)),
    );
    let number = BigInt(1);
    for (const document of documents) {
      if (document.internal_number != null) continue;
      while (used.has(String(number))) number += BigInt(1);
      await this.db.sequelize.query('update permit_documents set internal_number = :number where id = :id', {
        replacements: { number: String(number), id: document.id },
        transaction,
      });
      used.add(String(number));
      number += BigInt(1);
    }
  }
}
