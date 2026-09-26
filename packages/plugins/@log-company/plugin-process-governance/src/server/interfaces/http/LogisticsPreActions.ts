/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import { ValidateRunParents } from '../../application/logistics/ValidateRunParents';
import { ValidateShipmentDeletion } from '../../application/logistics/ValidateShipmentDeletion';
import type { LogisticsRepository } from '../../application/logistics/ports/LogisticsRepository';
import { LogisticsError } from '../../domain/logistics/LogisticsError';
import {
  extractIdentifier,
  normalizeIdentifiers,
  uniqueIdentifiers,
  type EntityId,
} from '../../domain/shared/Identifiers';
import { LOGISTICS_COLLECTIONS } from '../../../shared/logistics';
import { logisticsErrorStatus } from '../logistics/LogisticsHttpError';

interface ActionContext {
  throw?: (status: number, message: string) => never;
  action?: {
    actionName?: string;
    sourceId?: unknown;
    params?: Record<string, unknown>;
  };
}

const SHIPMENT_REFERENCE_FIELDS = ['chinese_client', 'company', 'contract_record', 'customs_warehouse'] as const;
const RUN_SHIPMENTS_FIELD = 'shipments';

export class LogisticsPreActions {
  constructor(
    private readonly plugin: Plugin,
    private readonly repository: LogisticsRepository,
    private readonly validateRunParents: ValidateRunParents,
    private readonly validateShipmentDeletion: ValidateShipmentDeletion,
  ) {}

  register(): void {
    this.plugin.app.resourcer.registerPreActionHandler(`${LOGISTICS_COLLECTIONS.runs}:create`, this.runAction);
    this.plugin.app.resourcer.registerPreActionHandler(`${LOGISTICS_COLLECTIONS.runs}:update`, this.runAction);
    for (const resource of [LOGISTICS_COLLECTIONS.shipments, `${LOGISTICS_COLLECTIONS.runs}.shipments`]) {
      this.plugin.app.resourcer.registerPreActionHandler(`${resource}:create`, this.shipmentWrite);
      this.plugin.app.resourcer.registerPreActionHandler(`${resource}:update`, this.shipmentWrite);
    }
    this.plugin.app.resourcer.registerPreActionHandler(
      `${LOGISTICS_COLLECTIONS.runs}.parent_runs:add`,
      this.parentRelation,
    );
    this.plugin.app.resourcer.registerPreActionHandler(
      `${LOGISTICS_COLLECTIONS.runs}.parent_runs:set`,
      this.parentRelation,
    );
    this.plugin.app.resourcer.registerPreActionHandler(
      `${LOGISTICS_COLLECTIONS.runs}.parent_runs:remove`,
      this.parentRelation,
    );
    this.plugin.app.resourcer.registerPreActionHandler(`${LOGISTICS_COLLECTIONS.runParents}:create`, this.parentLink);
    this.plugin.app.resourcer.registerPreActionHandler(`${LOGISTICS_COLLECTIONS.runParents}:update`, this.parentLink);
    this.plugin.app.resourcer.registerPreActionHandler(
      `${LOGISTICS_COLLECTIONS.shipments}:destroy`,
      this.shipmentDestroy,
    );
    for (const collection of [LOGISTICS_COLLECTIONS.runHistory, LOGISTICS_COLLECTIONS.shipmentHistory]) {
      for (const action of ['create', 'update', 'destroy']) {
        this.plugin.app.resourcer.registerPreActionHandler(`${collection}:${action}`, this.denyHistoryWrite);
      }
    }
  }

  private readonly runAction = async (context: ActionContext, next: () => Promise<unknown>): Promise<void> => {
    await this.mapErrors(context, async () => {
      const params = context.action?.params;
      const values = this.asRecord(params?.values);
      this.normalizeRunShipmentReferences(params, values);
      if (Object.prototype.hasOwnProperty.call(values, 'parent_runs')) {
        const runId =
          context.action?.actionName === 'create' ? extractIdentifier(values.id) : this.actionIdentifier(context);
        await this.validateRunParents.execute({
          runId,
          parentIds: normalizeIdentifiers(values.parent_runs),
        });
      }
      await next();
    });
  };

  private normalizeRunShipmentReferences(
    params: Record<string, unknown> | undefined,
    values: Record<string, unknown>,
  ): void {
    if (!params) {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(values, RUN_SHIPMENTS_FIELD)) {
      const rawShipments = values[RUN_SHIPMENTS_FIELD];
      const shipmentIds = uniqueIdentifiers(normalizeIdentifiers(rawShipments));
      const explicitlyCleared = rawShipments === null || (Array.isArray(rawShipments) && rawShipments.length === 0);

      if (shipmentIds.length > 0 || explicitlyCleared) {
        values[RUN_SHIPMENTS_FIELD] = shipmentIds;
      } else {
        delete values[RUN_SHIPMENTS_FIELD];
      }
    }

    if (Array.isArray(params.updateAssociationValues)) {
      params.updateAssociationValues = params.updateAssociationValues.filter(
        (value): value is string =>
          typeof value === 'string' && value !== RUN_SHIPMENTS_FIELD && !value.startsWith(`${RUN_SHIPMENTS_FIELD}.`),
      );
    }
  }

  private readonly parentRelation = async (context: ActionContext, next: () => Promise<unknown>): Promise<void> => {
    await this.mapErrors(context, async () => {
      const runId = extractIdentifier(context.action?.sourceId ?? context.action?.params?.associatedIndex);
      if (runId === null || context.action?.actionName === 'remove') {
        await next();
        return;
      }
      const incomingIds = normalizeIdentifiers(
        context.action?.params?.filterByTk ?? context.action?.params?.filterByTks ?? context.action?.params?.values,
      );
      const parentIds =
        context.action?.actionName === 'add'
          ? uniqueIdentifiers([...(await this.repository.getRunParentIds(runId)), ...incomingIds])
          : incomingIds;
      await this.validateRunParents.execute({ runId, parentIds });
      await next();
    });
  };

  private readonly parentLink = async (context: ActionContext, next: () => Promise<unknown>): Promise<void> => {
    await this.mapErrors(context, async () => {
      const rawValues = context.action?.params?.values;
      const rows = Array.isArray(rawValues) ? rawValues : [rawValues];
      for (const rawRow of rows) {
        const row = this.asRecord(rawRow);
        const childRunId = extractIdentifier(row.child_run_id ?? row.childRunId);
        const parentRunId = extractIdentifier(row.parent_run_id ?? row.parentRunId);
        if (childRunId !== null && parentRunId !== null) {
          await this.validateRunParents.execute({ runId: childRunId, parentIds: [parentRunId] });
        }
      }
      await next();
    });
  };

  private readonly shipmentDestroy = async (context: ActionContext, next: () => Promise<unknown>): Promise<void> => {
    await this.mapErrors(context, async () => {
      const shipmentId = this.actionIdentifier(context);
      if (shipmentId !== null) {
        await this.validateShipmentDeletion.execute(shipmentId);
      }
      await next();
    });
  };

  private readonly shipmentWrite = async (context: ActionContext, next: () => Promise<unknown>): Promise<void> => {
    const params = context.action?.params;
    if (!params) {
      await next();
      return;
    }

    const rawValues = params.values;
    const rows = Array.isArray(rawValues) ? rawValues : [rawValues];
    for (const rawRow of rows) {
      const values = this.asRecord(rawRow);
      for (const field of SHIPMENT_REFERENCE_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(values, field)) {
          continue;
        }
        const value = values[field];
        if (value === null) {
          continue;
        }
        const identifier = extractIdentifier(value);
        if (identifier !== null) {
          values[field] = identifier;
        } else if (context.action?.actionName === 'update') {
          delete values[field];
        }
      }
    }

    if (Array.isArray(params.updateAssociationValues)) {
      params.updateAssociationValues = params.updateAssociationValues.filter(
        (value): value is string =>
          typeof value === 'string' &&
          !SHIPMENT_REFERENCE_FIELDS.some((field) => value === field || value.startsWith(`${field}.`)),
      );
    }
    await next();
  };

  private readonly denyHistoryWrite = async (context: ActionContext): Promise<void> => {
    const message = 'История создаётся автоматически и недоступна для ручного изменения.';
    if (context.throw) {
      context.throw(403, message);
    }
    throw this.httpError(403, message);
  };

  private actionIdentifier(context: ActionContext): EntityId | null {
    return extractIdentifier(
      context.action?.params?.filterByTk ?? context.action?.params?.resourceIndex ?? context.action?.sourceId,
    );
  }

  private async mapErrors(context: ActionContext, work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      if (error instanceof LogisticsError) {
        const status = logisticsErrorStatus(error);
        if (context.throw) {
          context.throw(status, error.message);
        }
        throw this.httpError(status, error.message);
      }
      throw error;
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private httpError(status: number, message: string): Error {
    return Object.assign(new Error(message), { status, statusCode: status });
  }
}
