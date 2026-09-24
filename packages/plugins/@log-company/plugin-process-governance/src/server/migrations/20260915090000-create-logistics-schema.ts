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
import { LOGISTICS_COLLECTIONS } from '../../shared/logistics';

interface CollectionsMetadataRepository {
  findOne(options: { filter: { name: string } }): Promise<unknown>;
  db2cm?(name: string): Promise<void>;
}

const DEFINED_COLLECTIONS = [
  LOGISTICS_COLLECTIONS.vehicles,
  LOGISTICS_COLLECTIONS.runs,
  LOGISTICS_COLLECTIONS.shipments,
  LOGISTICS_COLLECTIONS.runHistory,
  LOGISTICS_COLLECTIONS.shipmentHistory,
  LOGISTICS_COLLECTIONS.shipmentComments,
] as const;

const THROUGH_COLLECTIONS = [
  LOGISTICS_COLLECTIONS.runShipments,
  LOGISTICS_COLLECTIONS.runManagers,
  LOGISTICS_COLLECTIONS.runDeclarants,
  LOGISTICS_COLLECTIONS.runParents,
] as const;

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    for (const collectionName of DEFINED_COLLECTIONS) {
      const collection = this.db.getCollection(collectionName);
      if (collection) {
        await collection.sync({ alter: { drop: false } });
      }
    }

    for (const collectionName of THROUGH_COLLECTIONS) {
      const collection = this.db.getCollection(collectionName);
      if (collection) {
        await collection.sync({ alter: { drop: false } });
      }
    }

    await this.ensureMetadata();
    await this.ensureImmutableNumber('transport_runs', 'run_number', 'transport_runs_run_number_seq');
    await this.ensureImmutableNumber('shipments', 'shipment_number', 'shipments_shipment_number_seq');
    await this.ensureJoinIndexes();
  }

  async down(): Promise<void> {
    // The logistics tables and their user data must be preserved.
  }

  private async ensureMetadata(): Promise<void> {
    const repository = this.db.getRepository('collections') as unknown as CollectionsMetadataRepository;
    for (const collectionName of DEFINED_COLLECTIONS) {
      const exists = await repository.findOne({ filter: { name: collectionName } });
      if (!exists && repository.db2cm) {
        await repository.db2cm(collectionName);
      }
    }
  }

  private async ensureImmutableNumber(table: string, column: string, sequence: string): Promise<void> {
    const queryInterface = this.db.sequelize.getQueryInterface();
    await queryInterface.changeColumn(table, column, {
      type: DataTypes.INTEGER,
      allowNull: false,
    });
    await this.db.sequelize.query(`CREATE SEQUENCE IF NOT EXISTS ${sequence}`);
    await this.db.sequelize.query(`
      DO $$
      DECLARE current_max bigint;
      BEGIN
        EXECUTE 'SELECT max(${column}) FROM ${table}' INTO current_max;
        IF current_max IS NULL THEN
          PERFORM setval('${sequence}', 1, false);
        ELSE
          PERFORM setval('${sequence}', current_max, true);
        END IF;
      END $$
    `);
    await this.db.sequelize.query(`
      ALTER TABLE ${table}
      ALTER COLUMN ${column} SET DEFAULT nextval('${sequence}')
    `);
  }

  private async ensureJoinIndexes(): Promise<void> {
    await this.db.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS transport_run_shipments_pair_unique
      ON transport_run_shipments(transport_run_id, shipment_id)
    `);
    await this.db.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS transport_run_managers_pair_unique
      ON transport_run_managers(transport_run_id, user_id)
    `);
    await this.db.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS transport_run_declarants_pair_unique
      ON transport_run_declarants(transport_run_id, user_id)
    `);
    await this.db.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS transport_run_parent_links_pair_unique
      ON transport_run_parent_links(child_run_id, parent_run_id)
    `);
  }
}
