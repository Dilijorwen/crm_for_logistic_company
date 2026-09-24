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

const TABLES = ['process_document_folders', 'process_documents'] as const;

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    const queryInterface = this.db.sequelize.getQueryInterface();
    for (const table of TABLES) {
      const columns = await queryInterface.describeTable(table);
      if (!columns.shipment_id) {
        await queryInterface.addColumn(table, 'shipment_id', {
          type: DataTypes.BIGINT,
          allowNull: true,
        });
      }
    }

    await this.db.sequelize.query(`
      create index if not exists process_document_folders_shipment_id_idx
        on process_document_folders(shipment_id);
      create index if not exists process_documents_shipment_id_idx
        on process_documents(shipment_id);
    `);

    await this.ensureForeignKey('process_document_folders', 'process_document_folders_shipment_id_fk');
    await this.ensureForeignKey('process_documents', 'process_documents_shipment_id_fk');
    await this.synchronizeMetadata();
  }

  async down(): Promise<void> {
    // Shipment links and all legacy process document data are intentionally preserved.
  }

  private async ensureForeignKey(table: string, name: string): Promise<void> {
    const [rows] = (await this.db.sequelize.query(
      `select 1 from pg_constraint where connamespace = current_schema()::regnamespace and conname = :name limit 1`,
      { replacements: { name } },
    )) as [unknown[], unknown];
    if (rows.length) {
      return;
    }
    await this.db.sequelize.getQueryInterface().addConstraint(table, {
      fields: ['shipment_id'],
      type: 'foreign key',
      name,
      references: { table: 'shipments', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  }

  private async synchronizeMetadata(): Promise<void> {
    const fieldOptions = {
      allowNull: true,
      hidden: true,
      uiSchema: {
        type: 'number',
        title: 'Поставка',
        'x-component': 'InputNumber',
        'x-read-pretty': true,
      },
    };
    for (const table of TABLES) {
      await this.db.sequelize.query(
        `
          insert into fields (key, name, type, interface, "collectionName", options, sort)
          values (:key, 'shipment_id', 'bigInt', 'integer', :collectionName, cast(:options as json), 25)
          on conflict ("collectionName", name)
          do update set type = excluded.type, interface = excluded.interface, options = excluded.options
        `,
        {
          replacements: {
            key: `${table}_shipment_id`,
            collectionName: table,
            options: JSON.stringify(fieldOptions),
          },
        },
      );
    }

    await this.db.sequelize.query(`
      update collections set title = 'Папки документов поставки' where name = 'process_document_folders';
      update collections set title = 'Документы поставки' where name = 'process_documents';
      update fields
      set options = jsonb_set(coalesce(options::jsonb, '{}'::jsonb), '{hidden}', 'true'::jsonb, true)::json
      where "collectionName" in ('process_document_folders', 'process_documents') and name = 'process_id';
    `);
  }
}
