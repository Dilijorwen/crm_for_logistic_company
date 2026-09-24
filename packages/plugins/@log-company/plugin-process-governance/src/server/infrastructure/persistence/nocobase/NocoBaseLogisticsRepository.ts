/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { CreateOptions, Transaction } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import type { LogisticsEntityKind, LogisticsHistoryEntry } from '../../../domain/logistics/LogisticsHistory';
import { formatLogisticsHistoryValue } from '../../../domain/logistics/LogisticsHistory';
import type { EntityId } from '../../../domain/shared/Identifiers';
import type { ShipmentDisplayNameParts } from '../../../domain/logistics/ShipmentDisplayName';
import type {
  LogisticsRepository,
  LogisticsTransaction,
  LogisticsValuesSnapshot,
  TrackedLogisticsField,
} from '../../../application/logistics/ports/LogisticsRepository';
import { LOGISTICS_COLLECTIONS } from '../../../../shared/logistics';

const RUN_NUMBER_SEQUENCE = 'transport_runs_run_number_seq';
const SHIPMENT_NUMBER_SEQUENCE = 'shipments_shipment_number_seq';
const RUN_PARENT_GRAPH_LOCK = 'log-company-transport-run-parent-graph';
const VEHICLE_LOCK_PREFIX = 'log-company-vehicle:';

const SYSTEM_FIELDS = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'createdById',
  'updatedById',
  'run_number',
  'shipment_number',
  'display_name',
  'registration_number_input',
]);

const EXCLUDED_ASSOCIATIONS = new Set([
  'runs',
  'shipments',
  'managers',
  'declarants',
  'parent_runs',
  'child_runs',
  'comments',
  'history',
]);

interface EnumOptionMetadata {
  value?: unknown;
  label?: unknown;
}

interface LogisticsHistoryCreateOptions extends CreateOptions {
  logisticsAuditInternal: true;
}

export class NocoBaseLogisticsRepository implements LogisticsRepository {
  constructor(private readonly plugin: Plugin) {}

  async nextNumber(entityKind: LogisticsEntityKind, transaction?: LogisticsTransaction): Promise<number> {
    const sequence = entityKind === 'run' ? RUN_NUMBER_SEQUENCE : SHIPMENT_NUMBER_SEQUENCE;
    const [rows] = (await this.plugin.db.sequelize.query(`select nextval('${sequence}') as value`, {
      transaction: this.asTransaction(transaction),
    })) as [Array<{ value: string | number }>, unknown];
    return Number(rows[0]?.value);
  }

  async findOrCreateVehicle(registrationNumber: string, transaction?: LogisticsTransaction): Promise<EntityId> {
    await this.lockVehicle(registrationNumber, transaction);
    const repository = this.plugin.db.getRepository(LOGISTICS_COLLECTIONS.vehicles);
    const existing = await repository.findOne({
      filter: { registration_number: registrationNumber },
      transaction: this.asTransaction(transaction),
    });
    if (existing) {
      return this.requiredId(existing.get('id'));
    }
    const created = await repository.create({
      values: { registration_number: registrationNumber },
      transaction: this.asTransaction(transaction),
    });
    return this.requiredId(created.get('id'));
  }

  async lockRunParentGraph(transaction?: LogisticsTransaction): Promise<void> {
    if (!transaction || this.plugin.db.sequelize.getDialect() !== 'postgres') {
      return;
    }
    await this.plugin.db.sequelize.query('select pg_advisory_xact_lock(hashtext(:key))', {
      replacements: { key: RUN_PARENT_GRAPH_LOCK },
      transaction: this.asTransaction(transaction),
    });
  }

  async getRunParentIds(runId: EntityId, transaction?: LogisticsTransaction): Promise<EntityId[]> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `select parent_run_id from ${LOGISTICS_COLLECTIONS.runParents} where child_run_id = :runId`,
      { replacements: { runId }, transaction: this.asTransaction(transaction) },
    )) as [Array<{ parent_run_id: EntityId }>, unknown];
    return rows.map((row) => row.parent_run_id);
  }

  async runParentSelectionCreatesCycle(
    runId: EntityId,
    parentIds: EntityId[],
    transaction?: LogisticsTransaction,
  ): Promise<boolean> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        with recursive descendants(id) as (
          select child_run_id
          from ${LOGISTICS_COLLECTIONS.runParents}
          where parent_run_id = :runId
          union
          select link.child_run_id
          from ${LOGISTICS_COLLECTIONS.runParents} link
          inner join descendants on descendants.id = link.parent_run_id
        )
        select id from descendants where id in (:parentIds) limit 1
      `,
      {
        replacements: { runId, parentIds },
        transaction: this.asTransaction(transaction),
      },
    )) as [Array<{ id: EntityId }>, unknown];
    return rows.length > 0;
  }

  async countShipmentRunLinks(shipmentId: EntityId, transaction?: LogisticsTransaction): Promise<number> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `select count(*) as value from ${LOGISTICS_COLLECTIONS.runShipments} where shipment_id = :shipmentId`,
      { replacements: { shipmentId }, transaction: this.asTransaction(transaction) },
    )) as [Array<{ value: string | number }>, unknown];
    return Number(rows[0]?.value ?? 0);
  }

  async isContractLinkedToCompany(
    contractId: EntityId,
    companyId: EntityId,
    transaction?: LogisticsTransaction,
  ): Promise<boolean> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `select 1 from importer_contracts where contract_id = :contractId and importer_id = :companyId limit 1`,
      {
        replacements: { contractId, companyId },
        transaction: this.asTransaction(transaction),
      },
    )) as [unknown[], unknown];
    return rows.length > 0;
  }

  async getRunRegistrationNumbers(
    runIds: EntityId[],
    transaction?: LogisticsTransaction,
  ): Promise<Map<string, string>> {
    if (!runIds.length) {
      return new Map();
    }
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        select r.id, v.registration_number
        from ${LOGISTICS_COLLECTIONS.runs} r
        inner join ${LOGISTICS_COLLECTIONS.vehicles} v on v.id = r.vehicle_id
        where r.id in (:runIds)
      `,
      { replacements: { runIds }, transaction: this.asTransaction(transaction) },
    )) as [Array<{ id: EntityId; registration_number: string }>, unknown];
    return new Map(rows.map((row) => [String(row.id), row.registration_number]));
  }

  async getShipmentDisplayNameParts(
    shipmentId: EntityId,
    transaction?: LogisticsTransaction,
  ): Promise<ShipmentDisplayNameParts | null> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        select
          s.shipment_number,
          c.name as client_name,
          s.invoice_number,
          s.application_number,
          s.declaration_number
        from ${LOGISTICS_COLLECTIONS.shipments} s
        left join chinese_clients c on c.id = s.chinese_client_id
        where s.id = :shipmentId
        limit 1
      `,
      { replacements: { shipmentId }, transaction: this.asTransaction(transaction) },
    )) as [
      Array<{
        shipment_number: unknown;
        client_name: unknown;
        invoice_number: unknown;
        application_number: unknown;
        declaration_number: unknown;
      }>,
      unknown,
    ];
    const row = rows[0];
    return row
      ? {
          shipmentNumber: row.shipment_number,
          clientName: row.client_name,
          invoiceNumber: row.invoice_number,
          applicationNumber: row.application_number,
          declarationNumber: row.declaration_number,
        }
      : null;
  }

  async updateShipmentDisplayName(
    shipmentId: EntityId,
    displayName: string,
    transaction?: LogisticsTransaction,
  ): Promise<void> {
    await this.plugin.db.sequelize.query(
      `update ${LOGISTICS_COLLECTIONS.shipments} set display_name = :displayName where id = :shipmentId`,
      {
        replacements: { shipmentId, displayName },
        transaction: this.asTransaction(transaction),
      },
    );
  }

  async getShipmentIdsByClientId(clientId: EntityId, transaction?: LogisticsTransaction): Promise<EntityId[]> {
    const [rows] = (await this.plugin.db.sequelize.query(
      `select id from ${LOGISTICS_COLLECTIONS.shipments} where chinese_client_id = :clientId`,
      { replacements: { clientId }, transaction: this.asTransaction(transaction) },
    )) as [Array<{ id: EntityId }>, unknown];
    return rows.map((row) => row.id);
  }

  getTrackedFields(entityKind: LogisticsEntityKind): TrackedLogisticsField[] {
    const collection = this.plugin.db.getCollection(this.collectionFor(entityKind));
    if (!collection) {
      return [];
    }
    return collection
      .getFields()
      .filter((field) => this.isTrackedField(field))
      .map((field) => {
        const options = field.options;
        const enumOptions = Array.isArray(options?.uiSchema?.enum)
          ? options.uiSchema.enum.map((item: EnumOptionMetadata) => ({
              value: item.value,
              label: String(item.label ?? item.value ?? ''),
            }))
          : undefined;
        return {
          name: options.name,
          label:
            entityKind === 'run' && options.name === 'vehicle'
              ? 'Номер машины'
              : options?.uiSchema?.title || options.name,
          storageKey: field.type === 'belongsTo' ? options.foreignKey : options.name,
          kind: field.type === 'belongsTo' ? 'belongsTo' : 'scalar',
          targetCollection: options.target,
          targetKey: options.targetKey || 'id',
          enumOptions,
        } as TrackedLogisticsField;
      });
  }

  async findEntityValues(
    entityKind: LogisticsEntityKind,
    entityId: EntityId,
    fields: TrackedLogisticsField[],
    transaction?: LogisticsTransaction,
  ): Promise<LogisticsValuesSnapshot | null> {
    const record = await this.plugin.db.getRepository(this.collectionFor(entityKind)).findOne({
      filter: { id: entityId },
      transaction: this.asTransaction(transaction),
    });
    if (!record) {
      return null;
    }
    return fields.reduce<LogisticsValuesSnapshot>((snapshot, field) => {
      snapshot[field.name] = record.get(field.storageKey);
      return snapshot;
    }, {});
  }

  async getRecordLabel(
    collectionName: string,
    id: EntityId,
    targetKey: string,
    transaction?: LogisticsTransaction,
  ): Promise<string> {
    const collection = this.plugin.db.getCollection(collectionName);
    const record = await this.plugin.db.getRepository(collectionName).findOne({
      filter: { [targetKey]: id },
      transaction: this.asTransaction(transaction),
    });
    if (!record) {
      return String(id);
    }
    if (collectionName === 'users') {
      return formatLogisticsHistoryValue(record.get('nickname') || record.get('username') || id);
    }
    const titleField = collection?.options?.titleField || 'title';
    return formatLogisticsHistoryValue(
      record.get(titleField) || record.get('name') || record.get('registration_number') || record.get('title') || id,
    );
  }

  async getEntityLabel(
    entityKind: LogisticsEntityKind,
    entityId: EntityId,
    transaction?: LogisticsTransaction,
  ): Promise<string> {
    const collectionName = this.collectionFor(entityKind);
    const record = await this.plugin.db.getRepository(collectionName).findOne({
      filter: { id: entityId },
      transaction: this.asTransaction(transaction),
    });
    if (!record) {
      return String(entityId);
    }
    const number = record.get(entityKind === 'run' ? 'run_number' : 'shipment_number');
    return entityKind === 'run' ? `Рейс №${number}` : `Поставка №${number}`;
  }

  historyCollectionExists(entityKind: LogisticsEntityKind): boolean {
    return Boolean(this.plugin.db.getCollection(this.historyCollectionFor(entityKind)));
  }

  async createHistory(
    entry: LogisticsHistoryEntry,
    transaction?: LogisticsTransaction,
    context?: unknown,
  ): Promise<void> {
    const foreignKey = entry.entityKind === 'run' ? 'transport_run_id' : 'shipment_id';
    const options: LogisticsHistoryCreateOptions = {
      values: {
        [foreignKey]: entry.entityId,
        event_type: entry.eventType,
        field_name: entry.fieldName,
        field_label: entry.fieldLabel,
        old_value: entry.oldValue,
        new_value: entry.newValue,
      },
      transaction: this.asTransaction(transaction),
      context,
      logisticsAuditInternal: true,
    };
    await this.plugin.db.getRepository(this.historyCollectionFor(entry.entityKind)).create(options);
  }

  private collectionFor(entityKind: LogisticsEntityKind): string {
    return entityKind === 'run' ? LOGISTICS_COLLECTIONS.runs : LOGISTICS_COLLECTIONS.shipments;
  }

  private historyCollectionFor(entityKind: LogisticsEntityKind): string {
    return entityKind === 'run' ? LOGISTICS_COLLECTIONS.runHistory : LOGISTICS_COLLECTIONS.shipmentHistory;
  }

  private isTrackedField(field: { type: string; options?: Record<string, unknown> }): boolean {
    const options = field.options || {};
    const name = typeof options.name === 'string' ? options.name : '';
    if (!name || SYSTEM_FIELDS.has(name) || EXCLUDED_ASSOCIATIONS.has(name) || options.isForeignKey) {
      return false;
    }
    return !['hasMany', 'belongsToMany', 'virtual'].includes(field.type);
  }

  private async lockVehicle(registrationNumber: string, transaction?: LogisticsTransaction): Promise<void> {
    if (!transaction || this.plugin.db.sequelize.getDialect() !== 'postgres') {
      return;
    }
    await this.plugin.db.sequelize.query('select pg_advisory_xact_lock(hashtext(:key))', {
      replacements: { key: `${VEHICLE_LOCK_PREFIX}${registrationNumber}` },
      transaction: this.asTransaction(transaction),
    });
  }

  private requiredId(value: unknown): EntityId {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
      return value;
    }
    throw new Error('Запись не содержит идентификатор.');
  }

  private asTransaction(transaction?: LogisticsTransaction): Transaction | undefined {
    return transaction as Transaction | undefined;
  }
}
