/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database, Model, Transaction } from '@nocobase/database';
import { LOGISTICS_WORKSPACE_VIEW_SQL } from '../read-model/LogisticsWorkspaceViewSql';
import { ARCHIVED_SHIPMENT_FIELDS, simplifyShipmentFields } from './SimplifyShipmentFields';

const COLLECTIONS = ['shipments', 'logistics_work_items'];

function retainedIndexes<T>(value: readonly T[] | undefined): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((index: unknown) => {
    if (!index || typeof index !== 'object' || !('fields' in index) || !Array.isArray(index.fields)) return true;
    return !index.fields.some((field: unknown) => {
      const name =
        typeof field === 'string' ? field : field && typeof field === 'object' && 'name' in field ? field.name : null;
      return typeof name === 'string' && ARCHIVED_SHIPMENT_FIELDS.has(name);
    });
  });
}

async function removePermissionFields(db: Database, transaction: Transaction): Promise<void> {
  if (!db.getCollection('dataSourcesRolesResources') || !db.getCollection('dataSourcesRolesResourcesActions')) return;
  const resources: Model[] = await db.getRepository('dataSourcesRolesResources').find({
    filter: { dataSourceKey: 'main', name: { $in: COLLECTIONS } },
    transaction,
  });
  if (!resources.length) return;
  const actions = await db.getRepository('dataSourcesRolesResourcesActions').find({
    filter: { rolesResourceId: { $in: resources.map((resource) => resource.get('id')) } },
    transaction,
  });
  for (const action of actions) {
    const fields: unknown = action.get('fields');
    if (!Array.isArray(fields)) continue;
    const remaining = fields.filter((name: unknown) => typeof name !== 'string' || !ARCHIVED_SHIPMENT_FIELDS.has(name));
    if (remaining.length !== fields.length) await action.update({ fields: remaining }, { transaction });
  }
}

/** Forward-only schema retirement. Keep audit entries and all unrelated business records. */
export async function removeShipmentFields(db: Database): Promise<void> {
  await db.sequelize.transaction(async (transaction) => {
    await simplifyShipmentFields(db, transaction);
    await removePermissionFields(db, transaction);
    if (db.getCollection('collections')) {
      const collections = await db
        .getRepository('collections')
        .find({ filter: { name: { $in: COLLECTIONS } }, transaction });
      for (const collection of collections) {
        const options: unknown = collection.get('options');
        if (!options || typeof options !== 'object' || !('indexes' in options) || !Array.isArray(options.indexes))
          continue;
        await collection.update(
          { options: { ...options, indexes: retainedIndexes(options.indexes) } },
          { transaction, hooks: false },
        );
      }
    }
    // PostgreSQL cannot remove view columns with CREATE OR REPLACE. RESTRICT keeps unknown dependencies intact.
    await db.sequelize.query('DROP VIEW IF EXISTS logistics_work_items', { transaction });
    if (db.getCollection('fields')) {
      await db.getCollection('fields').model.destroy({
        where: { collectionName: COLLECTIONS, name: [...ARCHIVED_SHIPMENT_FIELDS] },
        transaction,
        hooks: false,
      });
    }
    const queryInterface = db.sequelize.getQueryInterface();
    const queryOptions = { transaction, logging: false as const };
    const indexes: unknown = await queryInterface.showIndex('shipments', queryOptions);
    if (
      Array.isArray(indexes) &&
      indexes.some(
        (index: unknown) =>
          index && typeof index === 'object' && 'name' in index && index.name === 'shipments_route_delivery_number_idx',
      )
    ) {
      await queryInterface.removeIndex('shipments', 'shipments_route_delivery_number_idx', { transaction });
    }
    const columns = await queryInterface.describeTable('shipments', queryOptions);
    for (const name of ARCHIVED_SHIPMENT_FIELDS) {
      if (columns[name]) await queryInterface.removeColumn('shipments', name, { transaction });
    }
    await db.sequelize.query(LOGISTICS_WORKSPACE_VIEW_SQL, { transaction });
  });
  for (const collectionName of COLLECTIONS) {
    const collection = db.getCollection(collectionName);
    if (!collection) continue;
    collection.options.indexes = retainedIndexes(collection.options.indexes);
    for (const name of ARCHIVED_SHIPMENT_FIELDS) {
      if (collection.hasField(name)) collection.removeField(name);
    }
  }
}
