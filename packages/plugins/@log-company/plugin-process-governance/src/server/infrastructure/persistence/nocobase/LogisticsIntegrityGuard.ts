/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';

const UNIQUE_INDEX_QUERIES = [
  'CREATE UNIQUE INDEX IF NOT EXISTS vehicles_registration_number_unique ON vehicles(registration_number)',
  'CREATE UNIQUE INDEX IF NOT EXISTS transport_runs_run_number_unique ON transport_runs(run_number)',
  'CREATE UNIQUE INDEX IF NOT EXISTS shipments_shipment_number_unique ON shipments(shipment_number)',
] as const;

export function configureShipmentClientDeletionRules(db: Database): void {
  // NocoBase applies each many-to-many field's rule to both foreign keys.
  // Match the asymmetric PostgreSQL constraints after both fields have been loaded.
  for (const [collection, foreignKey, onDelete] of [
    ['shipments', 'shipment_id', 'CASCADE'],
    ['chinese_clients', 'chinese_client_id', 'RESTRICT'],
  ] as const) {
    const references = db.referenceMap.getReferences(collection) || [];
    const membership = references.find(
      (reference) =>
        reference.sourceCollectionName === 'shipment_chinese_clients' &&
        reference.sourceField === foreignKey &&
        reference.targetField === 'id',
    );
    if (membership) membership.onDelete = onDelete;
  }
}

export class LogisticsIntegrityGuard {
  constructor(private readonly plugin: Plugin) {}

  register(): void {
    this.plugin.app.on('afterStart', () => configureShipmentClientDeletionRules(this.plugin.db));
    this.plugin.app.on('afterStart', this.ensureUniqueIndexes);
  }

  private readonly ensureUniqueIndexes = async (): Promise<void> => {
    if (this.plugin.db.sequelize.getDialect() !== 'postgres') {
      return;
    }
    for (const query of UNIQUE_INDEX_QUERIES) {
      await this.plugin.db.sequelize.query(query);
    }
  };
}
