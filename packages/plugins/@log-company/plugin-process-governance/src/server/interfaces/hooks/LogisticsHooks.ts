/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import { AssignImmutableNumber } from '../../application/logistics/AssignImmutableNumber';
import { CaptureLogisticsSnapshot } from '../../application/logistics/CaptureLogisticsSnapshot';
import { NormalizeShipmentNumericFields } from '../../application/logistics/NormalizeShipmentNumericFields';
import { RecordLogisticsCreated } from '../../application/logistics/RecordLogisticsCreated';
import { RecordLogisticsFieldChanges } from '../../application/logistics/RecordLogisticsFieldChanges';
import { RecordLogisticsRelationChange } from '../../application/logistics/RecordLogisticsRelationChange';
import { RefreshShipmentDisplayName } from '../../application/logistics/RefreshShipmentDisplayName';
import { ResolveRunVehicle } from '../../application/logistics/ResolveRunVehicle';
import { ValidateRunParents } from '../../application/logistics/ValidateRunParents';
import { ValidateShipmentContract } from '../../application/logistics/ValidateShipmentContract';
import { ValidateShipmentDeletion } from '../../application/logistics/ValidateShipmentDeletion';
import type {
  LogisticsRepository,
  LogisticsTransaction,
  LogisticsValuesSnapshot,
} from '../../application/logistics/ports/LogisticsRepository';
import { LogisticsError } from '../../domain/logistics/LogisticsError';
import type { LogisticsEntityKind } from '../../domain/logistics/LogisticsHistory';
import { normalizeVehicleRegistrationNumber } from '../../domain/logistics/VehicleRegistrationNumber';
import { extractIdentifier, sameIdentifier, type EntityId } from '../../domain/shared/Identifiers';
import { DEFAULT_LOGISTICS_STATUS, LOGISTICS_COLLECTIONS } from '../../../shared/logistics';
import { asLogisticsHttpError } from '../logistics/LogisticsHttpError';

interface NocoBaseModel {
  isNewRecord?: boolean;
  dataValues?: Record<string, unknown>;
  constructor?: { name?: string };
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  previous?(key: string): unknown;
}

interface HookOptions {
  transaction?: LogisticsTransaction;
  context?: unknown;
  inputValues?: unknown;
  values?: unknown;
  logisticsAuditInternal?: boolean;
}

export interface LogisticsHookActions {
  assignNumber: AssignImmutableNumber;
  resolveRunVehicle: ResolveRunVehicle;
  captureSnapshot: CaptureLogisticsSnapshot;
  normalizeShipmentNumericFields: NormalizeShipmentNumericFields;
  recordCreated: RecordLogisticsCreated;
  recordFieldChanges: RecordLogisticsFieldChanges;
  recordRelationChange: RecordLogisticsRelationChange;
  validateRunParents: ValidateRunParents;
  validateShipmentContract: ValidateShipmentContract;
  validateShipmentDeletion: ValidateShipmentDeletion;
  refreshShipmentDisplayName: RefreshShipmentDisplayName;
}

interface RelationDescriptor {
  collection: string;
  entityField: string;
  relatedField: string;
  relatedKind: 'run' | 'shipment' | 'user';
  addedEvent: 'parent_added' | 'manager_added' | 'declarant_added' | 'shipment_attached';
  removedEvent: 'parent_removed' | 'manager_removed' | 'declarant_removed' | 'shipment_detached';
  fieldName: string;
  fieldLabel: string;
}

const RELATIONS: RelationDescriptor[] = [
  {
    collection: LOGISTICS_COLLECTIONS.runParents,
    entityField: 'child_run_id',
    relatedField: 'parent_run_id',
    relatedKind: 'run',
    addedEvent: 'parent_added',
    removedEvent: 'parent_removed',
    fieldName: 'parent_runs',
    fieldLabel: 'Родительские рейсы',
  },
  {
    collection: LOGISTICS_COLLECTIONS.runManagers,
    entityField: 'transport_run_id',
    relatedField: 'user_id',
    relatedKind: 'user',
    addedEvent: 'manager_added',
    removedEvent: 'manager_removed',
    fieldName: 'managers',
    fieldLabel: 'Менеджеры',
  },
  {
    collection: LOGISTICS_COLLECTIONS.runDeclarants,
    entityField: 'transport_run_id',
    relatedField: 'user_id',
    relatedKind: 'user',
    addedEvent: 'declarant_added',
    removedEvent: 'declarant_removed',
    fieldName: 'declarants',
    fieldLabel: 'Декларанты',
  },
  {
    collection: LOGISTICS_COLLECTIONS.runShipments,
    entityField: 'transport_run_id',
    relatedField: 'shipment_id',
    relatedKind: 'shipment',
    addedEvent: 'shipment_attached',
    removedEvent: 'shipment_detached',
    fieldName: 'shipments',
    fieldLabel: 'Поставки',
  },
];

export class LogisticsHooks {
  private readonly preparedNewRecords = new WeakSet<object>();

  constructor(
    private readonly plugin: Plugin,
    private readonly repository: LogisticsRepository,
    private readonly actions: LogisticsHookActions,
  ) {}

  register(): void {
    this.registerVehicleHooks();
    this.registerRunReadProjection();
    this.registerShipmentClientHooks();
    this.registerEntityHooks('run', LOGISTICS_COLLECTIONS.runs, 'run_number');
    this.registerEntityHooks('shipment', LOGISTICS_COLLECTIONS.shipments, 'shipment_number');
    this.registerRelationHooks();
    this.registerHistoryGuards();
  }

  private registerVehicleHooks(): void {
    for (const event of ['beforeCreate', 'beforeUpdate']) {
      this.plugin.db.on(`${LOGISTICS_COLLECTIONS.vehicles}.${event}`, (model: NocoBaseModel) => {
        try {
          model.set('registration_number', normalizeVehicleRegistrationNumber(model.get('registration_number')));
        } catch (error) {
          if (error instanceof LogisticsError) {
            throw asLogisticsHttpError(error);
          }
          throw error;
        }
      });
    }
  }

  private registerEntityHooks(entityKind: LogisticsEntityKind, collection: string, numberField: string): void {
    this.plugin.db.on(`${collection}.beforeValidate`, async (model: NocoBaseModel, options: HookOptions) => {
      if (entityKind === 'shipment') {
        this.prepareShipmentAssociations(model, options);
        await this.mapDomainErrors(() => {
          this.prepareShipmentNumericFields(model, options);
        });
        await this.validateShipmentContract(model, options);
      }
      if (model.isNewRecord === false || this.preparedNewRecords.has(model)) {
        return;
      }
      await this.mapDomainErrors(async () => {
        model.set(
          numberField,
          await this.actions.assignNumber.execute({
            entityKind,
            isNewRecord: true,
            previousNumber: undefined,
            currentNumber: model.get(numberField),
            transaction: options.transaction,
          }),
        );
        if (entityKind === 'run') {
          await this.prepareRunVehicle(model, options, true);
          if (!model.get('status')) {
            model.set('status', DEFAULT_LOGISTICS_STATUS);
          }
        }
        this.preparedNewRecords.add(model);
      });
    });

    this.plugin.db.on(`${collection}.beforeUpdate`, async (model: NocoBaseModel, options: HookOptions) => {
      await this.mapDomainErrors(async () => {
        const entityId = this.requiredIdentifier(model.get('id'), entityKind);
        await this.actions.captureSnapshot.execute({
          entityKind,
          entityId,
          transaction: options.transaction,
          snapshotScope: options.transaction ?? options.context,
          fallbackSnapshot: this.previousSnapshot(model, entityKind),
        });
        model.set(
          numberField,
          await this.actions.assignNumber.execute({
            entityKind,
            isNewRecord: false,
            previousNumber: model.previous?.(numberField),
            currentNumber: model.get(numberField),
            transaction: options.transaction,
          }),
        );
        if (entityKind === 'run') {
          await this.prepareRunVehicle(model, options, false);
        }
      });
    });

    this.plugin.db.on(`${collection}.afterCreate`, async (model: NocoBaseModel, options: HookOptions) => {
      await this.actions.recordCreated.execute({
        entityKind,
        entityId: this.requiredIdentifier(model.get('id'), entityKind),
        transaction: options.transaction,
        context: options.context,
      });
      if (entityKind === 'shipment') {
        const displayName = await this.actions.refreshShipmentDisplayName.execute(
          this.requiredIdentifier(model.get('id'), entityKind),
          options.transaction,
        );
        if (displayName) {
          model.set('display_name', displayName);
          if (model.dataValues) {
            model.dataValues.display_name = displayName;
          }
        }
      }
    });

    this.plugin.db.on(
      `${collection}.afterUpdateWithAssociations`,
      async (model: NocoBaseModel, options: HookOptions) => {
        await this.actions.recordFieldChanges.execute({
          entityKind,
          entityId: this.requiredIdentifier(model.get('id'), entityKind),
          transaction: options.transaction,
          snapshotScope: options.transaction ?? options.context,
          context: options.context,
        });
        if (entityKind === 'shipment') {
          const displayName = await this.actions.refreshShipmentDisplayName.execute(
            this.requiredIdentifier(model.get('id'), entityKind),
            options.transaction,
          );
          if (displayName) {
            model.set('display_name', displayName);
            if (model.dataValues) {
              model.dataValues.display_name = displayName;
            }
          }
        }
      },
    );

    if (entityKind === 'shipment') {
      this.plugin.db.on(`${collection}.beforeDestroy`, async (model: NocoBaseModel, options: HookOptions) => {
        await this.mapDomainErrors(async () => {
          await this.actions.validateShipmentDeletion.execute(
            this.requiredIdentifier(model.get('id'), entityKind),
            options.transaction,
          );
        });
      });
    }
  }

  private registerRunReadProjection(): void {
    this.plugin.db.on('afterFind', async (instances: unknown) => {
      if (!instances) {
        return;
      }
      const records = (Array.isArray(instances) ? instances : [instances]).filter((record): record is NocoBaseModel =>
        this.isRunModel(record),
      );
      const runIds = records
        .map((record) => extractIdentifier(record.get('id')))
        .filter((id): id is EntityId => id !== null);
      const registrationNumbers = await this.repository.getRunRegistrationNumbers(runIds);
      for (const record of records) {
        const runId = extractIdentifier(record.get('id'));
        if (runId === null) {
          continue;
        }
        const registrationNumber = registrationNumbers.get(String(runId));
        if (!registrationNumber) {
          continue;
        }
        record.set('registration_number_input', registrationNumber);
        if (record.dataValues) {
          record.dataValues.registration_number_input = registrationNumber;
        }
      }
    });
  }

  private registerShipmentClientHooks(): void {
    this.plugin.db.on('chinese_clients.afterUpdate', async (model: NocoBaseModel, options: HookOptions) => {
      const clientId = extractIdentifier(model.get('id'));
      if (clientId === null) {
        return;
      }
      await this.actions.refreshShipmentDisplayName.executeForClient(clientId, options.transaction);
    });
  }

  private isRunModel(value: unknown): value is NocoBaseModel {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const model = value as Partial<NocoBaseModel>;
    if (typeof model.get !== 'function' || typeof model.set !== 'function') {
      return false;
    }
    const modelName = model.constructor?.name;
    return (
      modelName === LOGISTICS_COLLECTIONS.runs ||
      this.plugin.db.getCollection(modelName)?.name === LOGISTICS_COLLECTIONS.runs
    );
  }

  private registerRelationHooks(): void {
    for (const relation of RELATIONS) {
      if (relation.collection === LOGISTICS_COLLECTIONS.runParents) {
        this.plugin.db.on(`${relation.collection}.beforeCreate`, async (model: NocoBaseModel, options: HookOptions) => {
          await this.validateParentLink(model, options);
        });
        this.plugin.db.on(`${relation.collection}.beforeUpdate`, async (model: NocoBaseModel, options: HookOptions) => {
          await this.validateParentLink(model, options);
        });
      }
      this.plugin.db.on(`${relation.collection}.afterCreate`, async (model: NocoBaseModel, options: HookOptions) => {
        await this.recordRelation(
          relation,
          relation.addedEvent,
          model.get(relation.entityField),
          model.get(relation.relatedField),
          options,
        );
      });
      this.plugin.db.on(`${relation.collection}.afterDestroy`, async (model: NocoBaseModel, options: HookOptions) => {
        await this.recordRelation(
          relation,
          relation.removedEvent,
          model.get(relation.entityField),
          model.get(relation.relatedField),
          options,
        );
      });
      this.plugin.db.on(`${relation.collection}.afterUpdate`, async (model: NocoBaseModel, options: HookOptions) => {
        const oldEntityId = model.previous?.(relation.entityField);
        const oldRelatedId = model.previous?.(relation.relatedField);
        const newEntityId = model.get(relation.entityField);
        const newRelatedId = model.get(relation.relatedField);
        if (!sameIdentifier(oldEntityId, newEntityId) || !sameIdentifier(oldRelatedId, newRelatedId)) {
          await this.recordRelation(relation, relation.removedEvent, oldEntityId, oldRelatedId, options);
          await this.recordRelation(relation, relation.addedEvent, newEntityId, newRelatedId, options);
        }
      });
    }
  }

  private registerHistoryGuards(): void {
    for (const collection of [LOGISTICS_COLLECTIONS.runHistory, LOGISTICS_COLLECTIONS.shipmentHistory]) {
      this.plugin.db.on(`${collection}.beforeCreate`, async (_model: NocoBaseModel, options: HookOptions) => {
        if (!options.logisticsAuditInternal) {
          throw this.httpError(403, 'История создаётся автоматически и недоступна для ручного изменения.');
        }
      });
      this.plugin.db.on(`${collection}.beforeUpdate`, async () => {
        throw this.httpError(403, 'История неизменяема.');
      });
    }
  }

  private async prepareRunVehicle(model: NocoBaseModel, options: HookOptions, required: boolean): Promise<void> {
    const values = this.asRecord(options.inputValues ?? options.values);
    const hasInput = Object.prototype.hasOwnProperty.call(values, 'registration_number_input');
    const registrationNumber = hasInput ? values.registration_number_input : model.get('registration_number_input');
    if (!required && !hasInput && !registrationNumber) {
      return;
    }
    const resolved = await this.actions.resolveRunVehicle.execute({
      registrationNumber,
      transaction: options.transaction,
    });
    model.set('vehicle_id', resolved.vehicleId);
    model.set('registration_number_input', resolved.registrationNumber);
  }

  private prepareShipmentAssociations(model: NocoBaseModel, options: HookOptions): void {
    const values = this.asRecord(options.inputValues ?? options.values);
    this.projectAssociationIdentifier(model, values, 'chinese_client', 'chinese_client_id');
    this.projectAssociationIdentifier(model, values, 'company', 'company_id');
    this.projectAssociationIdentifier(model, values, 'contract_record', 'contract_id');
    this.projectAssociationIdentifier(model, values, 'customs_warehouse', 'customs_warehouse_id');
  }

  private prepareShipmentNumericFields(model: NocoBaseModel, options: HookOptions): void {
    const values = this.asRecord(options.inputValues ?? options.values);
    const normalizedValues = this.actions.normalizeShipmentNumericFields.execute(values);
    for (const [field, value] of Object.entries(normalizedValues)) {
      model.set(field, value);
    }
  }

  private projectAssociationIdentifier(
    model: NocoBaseModel,
    values: Record<string, unknown>,
    associationName: string,
    foreignKey: string,
  ): void {
    if (!Object.prototype.hasOwnProperty.call(values, associationName)) {
      return;
    }
    model.set(foreignKey, extractIdentifier(values[associationName]));
  }

  private async validateShipmentContract(model: NocoBaseModel, options: HookOptions): Promise<void> {
    await this.mapDomainErrors(async () => {
      await this.actions.validateShipmentContract.execute({
        companyId: extractIdentifier(model.get('company_id')),
        contractId: extractIdentifier(model.get('contract_id')),
        transaction: options.transaction,
      });
    });
  }

  private async validateParentLink(model: NocoBaseModel, options: HookOptions): Promise<void> {
    await this.mapDomainErrors(async () => {
      await this.actions.validateRunParents.execute({
        runId: extractIdentifier(model.get('child_run_id')),
        parentIds: this.optionalIdentifiers(model.get('parent_run_id')),
        transaction: options.transaction,
      });
    });
  }

  private async recordRelation(
    relation: RelationDescriptor,
    eventType: RelationDescriptor['addedEvent'] | RelationDescriptor['removedEvent'],
    entityValue: unknown,
    relatedValue: unknown,
    options: HookOptions,
  ): Promise<void> {
    const entityId = extractIdentifier(entityValue);
    const relatedId = extractIdentifier(relatedValue);
    if (entityId === null || relatedId === null) {
      return;
    }
    await this.actions.recordRelationChange.execute({
      entityId,
      relatedId,
      relatedKind: relation.relatedKind,
      eventType,
      fieldName: relation.fieldName,
      fieldLabel: relation.fieldLabel,
      transaction: options.transaction,
      context: options.context,
    });
  }

  private previousSnapshot(model: NocoBaseModel, entityKind: LogisticsEntityKind): LogisticsValuesSnapshot {
    return this.repository.getTrackedFields(entityKind).reduce<LogisticsValuesSnapshot>((snapshot, field) => {
      snapshot[field.name] = model.previous?.(field.storageKey);
      return snapshot;
    }, {});
  }

  private requiredIdentifier(value: unknown, entityKind: LogisticsEntityKind): EntityId {
    const identifier = extractIdentifier(value);
    if (identifier === null) {
      throw new Error(
        entityKind === 'run' ? 'Идентификатор рейса отсутствует.' : 'Идентификатор поставки отсутствует.',
      );
    }
    return identifier;
  }

  private optionalIdentifiers(value: unknown): EntityId[] {
    const identifier = extractIdentifier(value);
    return identifier === null ? [] : [identifier];
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private async mapDomainErrors(work: () => Promise<void> | void): Promise<void> {
    try {
      await work();
    } catch (error) {
      if (error instanceof LogisticsError) {
        throw asLogisticsHttpError(error);
      }
      throw error;
    }
  }

  private httpError(status: number, message: string): Error {
    return Object.assign(new Error(message), { status, statusCode: status });
  }
}
