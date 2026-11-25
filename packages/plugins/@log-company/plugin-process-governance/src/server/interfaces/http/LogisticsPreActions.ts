/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createUserProvider, parseJsonTemplate } from '@nocobase/acl';
import type { Context } from '@nocobase/actions';
import type { Model } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import { requireShipmentChineseClients } from '../../domain/logistics/ShipmentChineseClients';
import { asLogisticsHttpError } from '../logistics/LogisticsHttpError';
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
import { LOGISTICS_COLLECTIONS, SHIPMENT_REFERENCE_FIELDS } from '../../../shared/logistics';
import { WORKSPACE_DETACHED_SHIPMENT_IDS_FIELD, WORKSPACE_SHIPMENT_DOCUMENTS } from '../../../shared/workspace';
import { logisticsErrorStatus } from '../logistics/LogisticsHttpError';

interface ActionContext {
  throw?: (status: number, message: string) => never;
  can?: (input: { resource: string; action: string }) => { params?: { filter?: Record<string, unknown> } } | null;
  state?: Context['state'];
  get?: (header: string) => string;
  action?: {
    actionName?: string;
    sourceId?: unknown;
    params?: Record<string, unknown>;
  };
}

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
      const unified = params?.workspaceUnified === true || params?.workspaceUnified === 'true';
      const detach = values[WORKSPACE_DETACHED_SHIPMENT_IDS_FIELD];
      delete values[WORKSPACE_DETACHED_SHIPMENT_IDS_FIELD];
      const detachedIds = new Set<string>();
      if (unified && context.action?.actionName === 'update' && detach != null) {
        if (
          !Array.isArray(detach) ||
          detach.some((id) => !['number', 'string'].includes(typeof id) || !/^[1-9]\d*$/.test(String(id)))
        ) {
          throw this.httpError(400, 'Не удалось определить поставку для отвязки.');
        }
        for (const id of detach) detachedIds.add(String(id));
      }
      if (unified) {
        this.normalizeUnifiedShipments(params, values);
      } else {
        this.normalizeRunShipmentReferences(params, values);
      }
      if (Object.prototype.hasOwnProperty.call(values, 'parent_runs')) {
        const runId =
          context.action?.actionName === 'create' ? extractIdentifier(values.id) : this.actionIdentifier(context);
        await this.validateRunParents.execute({
          runId,
          parentIds: normalizeIdentifiers(values.parent_runs),
        });
      }
      const associations = params?.updateAssociationValues;
      if (params && Array.isArray(associations) && associations.includes('shipments')) {
        // A resource-specific pre-action takes precedence over NocoBase's generic
        // pre-action. Explicitly run the registered native association ACL before write.
        const manager = this.plugin.app.resourcer;
        const handlers = manager.getRegisteredPreActionHandlers('', context.action?.actionName || '');
        if (!handlers.length) throw this.httpError(403, 'Недоступна проверка прав на изменение поставок.');
        const shipmentRows =
          unified && Array.isArray(values.shipments)
            ? await this.prepareShipmentAclRows(context, values.shipments)
            : [];
        if (shipmentRows.length) {
          // NocoBase may remove the primary key from a permitted patch as a non-editable field.
          // Keep the result of each association check in its own array slot to retain its identity.
          params.values = [{ ...values, shipments: [] }, ...shipmentRows.map((row) => ({ shipments: [row] }))];
        }
        const preserveLinks = async () => {
          if (shipmentRows.length) this.restoreShipmentIdentities(params, shipmentRows);
          await this.preserveRunShipmentLinks(context, detachedIds);
          await next();
        };
        const proceed = handlers.reduceRight<typeof preserveLinks>(
          (downstream, handler) => () => handler(context as Parameters<typeof handler>[0], downstream),
          preserveLinks,
        );
        await proceed();
        return;
      }
      await next();
    });
  };

  private async prepareShipmentAclRows(context: ActionContext, rows: unknown[]): Promise<unknown[]> {
    const ids = uniqueIdentifiers(rows);
    if (!ids.length) return rows;
    if (ids.some((id) => !/^[1-9]\d*$/.test(String(id)))) {
      throw this.httpError(400, 'Не удалось определить выбранную поставку.');
    }
    const permission = context.can?.({ resource: LOGISTICS_COLLECTIONS.shipments, action: 'list' });
    if (context.can && !permission) {
      throw this.httpError(403, 'Нет прав на просмотр выбранных поставок.');
    }
    const rawFilter = permission?.params?.filter;
    const scope = rawFilter
      ? await parseJsonTemplate(rawFilter, {
          state: context.state,
          timezone: context.get?.('x-timezone'),
          userProvider: createUserProvider({ db: this.plugin.db, currentUser: context.state?.currentUser }),
        })
      : undefined;
    const selected = { id: { $in: ids } };
    const records = await this.plugin.db.getRepository('shipments').find({
      filter: scope ? { $and: [scope, selected] } : selected,
      fields: ['id'],
    });
    const storedIds = new Map<string, EntityId>();
    for (const record of records as Model[]) {
      const id = extractIdentifier(record.get('id'));
      if (id !== null) storedIds.set(String(id), id);
    }
    return rows.map((row) => {
      const id = extractIdentifier(row);
      if (id === null) return row;
      const stored = storedIds.get(String(id));
      if (stored == null) throw this.httpError(400, 'Одна из выбранных поставок больше недоступна.');
      return { ...this.asRecord(row), id: stored };
    });
  }

  private restoreShipmentIdentities(params: Record<string, unknown>, submittedRows: unknown[]): void {
    if (!Array.isArray(params.values) || params.values.length !== submittedRows.length + 1) {
      throw this.httpError(400, 'Не удалось проверить сохранение поставок.');
    }
    const [main, ...checkedRows] = params.values;
    const run = this.asRecord(main);
    if (!Array.isArray(run.shipments)) {
      throw this.httpError(403, 'Нет прав на изменение поставок рейса.');
    }
    run.shipments = checkedRows.map((checked, index) => {
      const { shipments } = this.asRecord(checked);
      if (!Array.isArray(shipments) || shipments[0] == null) {
        throw this.httpError(403, 'Нет прав на сохранение одной из поставок рейса.');
      }
      const row: unknown = shipments[0];
      const id = extractIdentifier(submittedRows[index]);
      if (id === null) {
        const documents = this.asRecord(submittedRows[index])[WORKSPACE_SHIPMENT_DOCUMENTS];
        return documents === undefined ? row : { ...this.asRecord(row), [WORKSPACE_SHIPMENT_DOCUMENTS]: documents };
      }
      const { id: checkedId, ...edits } = this.asRecord(row);
      return Object.keys(edits).length ? { ...edits, id } : id;
    });
    params.values = run;
  }

  private async preserveRunShipmentLinks(context: ActionContext, detachedIds: ReadonlySet<string>): Promise<void> {
    if (context.action?.actionName !== 'update') return;
    const runId = this.actionIdentifier(context);
    const values = this.asRecord(context.action.params?.values);
    if (runId === null || !Array.isArray(values.shipments)) return;
    const existing = await this.plugin.db.getRepository('transport_run_shipments').find({
      filter: { transport_run_id: runId },
      fields: ['shipment_id'],
    });
    const submitted = new Set(normalizeIdentifiers(values.shipments).map(String));
    for (const item of existing) {
      const id = extractIdentifier(item.get('shipment_id'));
      if (id !== null && !submitted.has(String(id)) && !detachedIds.has(String(id))) values.shipments.push(id);
    }
  }

  private normalizeUnifiedShipments(params: Record<string, unknown>, values: Record<string, unknown>): void {
    if (!Array.isArray(params.updateAssociationValues) || !params.updateAssociationValues.includes('shipments')) {
      this.normalizeRunShipmentReferences(params, values);
      return;
    }
    // Native association ACL checks each shipment's fields and record scope. Keep this
    // editor one level deep so reference pickers cannot write into other collections.
    params.updateAssociationValues = ['shipments'];
    if (!Array.isArray(values.shipments)) {
      delete values.shipments;
      return;
    }
    const scalarFields = this.plugin.db
      .getCollection('shipments')
      .getFields()
      .filter((field) => !field.target && !field.options.isForeignKey)
      .map((field) => field.name)
      .filter((name) => !['id', 'shipment_number', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'].includes(name));
    const editableFields = new Set<string>(['id', ...scalarFields, ...SHIPMENT_REFERENCE_FIELDS]);
    values.shipments = values.shipments
      .filter((item) => item != null)
      .map((item) => {
        if (typeof item === 'string' || typeof item === 'number') return item;
        const shipment = Object.fromEntries(
          Object.entries(this.asRecord(item)).filter(([key]) => editableFields.has(key)),
        );
        const documents = this.asRecord(item)[WORKSPACE_SHIPMENT_DOCUMENTS];
        if (documents !== undefined && extractIdentifier(shipment) === null) {
          shipment[WORKSPACE_SHIPMENT_DOCUMENTS] = documents;
        }
        for (const field of SHIPMENT_REFERENCE_FIELDS) {
          const value = shipment[field];
          if (value == null) continue;
          if (field === 'chinese_client') {
            try {
              shipment[field] = requireShipmentChineseClients(value);
            } catch (error) {
              if (error instanceof LogisticsError) throw asLogisticsHttpError(error);
              throw error;
            }
            continue;
          }
          const id = extractIdentifier(value);
          if (id === null) throw this.httpError(400, 'Не удалось определить выбранное значение поставки.');
          shipment[field] = id;
        }
        return shipment;
      })
      .filter((item) => typeof item !== 'object' || Object.keys(item).length);
  }

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
      if (Object.prototype.hasOwnProperty.call(values, 'runs')) {
        const rawRuns = values.runs;
        const runs = rawRuns === null ? [] : Array.isArray(rawRuns) ? rawRuns : [rawRuns];
        if (runs.some((run) => extractIdentifier(run) === null)) {
          const message = 'Не удалось определить рейс поставки. Выберите рейс и повторите сохранение.';
          if (context.throw) context.throw(400, message);
          throw this.httpError(400, message);
        }
        values.runs = uniqueIdentifiers(runs);
      }
      for (const field of SHIPMENT_REFERENCE_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(values, field)) {
          continue;
        }
        const value = values[field];
        if (field === 'chinese_client') {
          if (
            context.action?.actionName === 'update' &&
            value !== null &&
            !Array.isArray(value) &&
            extractIdentifier(value) === null
          ) {
            delete values[field];
            continue;
          }
          try {
            values[field] = requireShipmentChineseClients(value);
          } catch (error) {
            if (error instanceof LogisticsError) throw asLogisticsHttpError(error);
            throw error;
          }
          continue;
        }
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
          value !== 'runs' &&
          !value.startsWith('runs.') &&
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
