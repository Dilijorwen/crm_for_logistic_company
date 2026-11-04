/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createUserProvider, parseJsonTemplate } from '@nocobase/acl';
import actions, { type Context, type Next } from '@nocobase/actions';
import type { Plugin } from '@nocobase/server';
import type { WorkspaceReadModel } from '../../application/logistics/ports/WorkspaceReadModel';
import { LOGISTICS_COLLECTIONS, LOGISTICS_STATUS_LABELS, LOGISTICS_STATUS_VALUES } from '../../../shared/logistics';
import { TRANSPORT_TYPES, TRANSPORT_TYPE_LABELS } from '../../../shared/transport';
import { LOGISTICS_WORKSPACE_FIELD_SOURCES } from '../../infrastructure/read-model/LogisticsWorkspaceFields';

interface ReadPermission {
  params?: { fields?: string[]; appends?: string[]; filter?: Record<string, unknown> };
}

type WorkspaceContext = Context & {
  can?: (input: { resource: string; action: string }) => ReadPermission | null;
  permission?: { can?: ReadPermission };
  workspaceReadScope?: Record<string, unknown>;
};

const READ_ACTIONS = new Set(['list', 'get', 'searchCurrentCollection', 'export']);

function permittedFields(permission: ReadPermission): Set<string> | null {
  const { fields, appends } = permission.params || {};
  return Array.isArray(fields) || Array.isArray(appends) ? new Set([...(fields || []), ...(appends || [])]) : null;
}

function objectFilter(value: unknown): Record<string, unknown> | undefined {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  if (parsed === undefined || parsed === null) {
    return undefined;
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid filter');
  }
  return parsed as Record<string, unknown>;
}

/** Keeps the read model within the source collections' row and field permissions. */
export class LogisticsWorkspaceActions {
  constructor(
    private readonly plugin: Plugin,
    private readonly readModel: WorkspaceReadModel,
  ) {}

  register(): void {
    this.plugin.app.resourceManager.use((context, next) => this.authorize(context as WorkspaceContext, next), {
      tag: 'logistics-workspace-access',
      after: 'acl',
    });
    // A database view has no write events of its own. Query its current values
    // instead of using an index that cannot observe the source-table updates.
    this.plugin.app.resourceManager.define({
      name: LOGISTICS_COLLECTIONS.workItems,
      actions: { list: this.list, searchCurrentCollection: this.search },
    });
  }

  private readonly authorize = async (context: WorkspaceContext, next: Next): Promise<void> => {
    if (context.action.resourceName !== LOGISTICS_COLLECTIONS.workItems) {
      await next();
      return;
    }
    if (!READ_ACTIONS.has(context.action.actionName)) {
      context.throw(403, 'Рабочий список доступен только для чтения. Изменяйте исходный рейс или поставку.');
    }
    const runs = context.can?.({ resource: LOGISTICS_COLLECTIONS.runs, action: 'list' });
    const shipments = context.can?.({ resource: LOGISTICS_COLLECTIONS.shipments, action: 'list' });
    if (!runs || !shipments) {
      context.throw(403, 'Для рабочего списка требуется право просмотра рейсов и поставок.');
      return;
    }
    const runFields = permittedFields(runs);
    const shipmentFields = permittedFields(shipments);
    const workspaceFields = context.permission?.can ? permittedFields(context.permission.can) : null;
    const allowed = new Set([
      'id',
      ...LOGISTICS_WORKSPACE_FIELD_SOURCES.filter((field) => {
        const sourceFields = field.resource === 'transport_runs' ? runFields : shipmentFields;
        return (
          (!sourceFields || sourceFields.has(field.sourceField)) &&
          (!workspaceFields || workspaceFields.has(field.name))
        );
      }).map((field) => field.name),
    ]);
    const params = context.action.params;
    const requested = Array.isArray(params.fields) ? [...params.fields] : Array.from(allowed);
    if (params.workspaceGroupByRun === true || params.workspaceGroupByRun === 'true') {
      requested.push(
        ...LOGISTICS_WORKSPACE_FIELD_SOURCES.filter((field) => field.resource === 'transport_runs').map(
          (field) => field.name,
        ),
      );
    }
    params.fields = Array.from(new Set(['id', ...requested.filter((name) => allowed.has(name))]));
    params.appends = [];
    if (context.permission?.can) {
      context.permission.can = {
        ...context.permission.can,
        params: { ...context.permission.can.params, fields: Array.from(allowed), appends: [] },
      };
    }

    let filter: Record<string, unknown> | undefined;
    try {
      filter = objectFilter(params.filter);
      this.validateQueryFields(context, filter, allowed);
    } catch (error) {
      if (error instanceof Error && 'status' in error && error.status === 403) throw error;
      context.throw(400, 'Неверный формат фильтра рабочего списка.');
    }
    const requestedSort: unknown = params.sort;
    const sortFields = typeof requestedSort === 'string' ? requestedSort.split(',') : requestedSort;
    if (sortFields !== undefined && !Array.isArray(sortFields)) {
      context.throw(400, 'Неверный формат сортировки рабочего списка.');
    }
    const normalizedSort = Array.isArray(sortFields) ? sortFields : [];
    for (const sort of normalizedSort) {
      const sortField = typeof sort === 'string' ? sort.replace(/^-/, '') : '';
      if (!allowed.has(sortField)) {
        context.throw(403, 'Нет прав для сортировки по выбранному полю.');
      }
    }
    params.sort = normalizedSort;
    const sourceFilters: Record<string, unknown>[] = [];
    for (const [relation, permission] of [
      ['run', runs],
      ['shipment', shipments],
    ] as const) {
      if (!permission.params?.filter) continue;
      const scope = await parseJsonTemplate(permission.params.filter, {
        state: context.state,
        timezone: context.get('x-timezone'),
        userProvider: createUserProvider({ db: context.db || this.plugin.db, currentUser: context.state.currentUser }),
      });
      const scoped = { [relation]: scope ?? permission.params.filter };
      sourceFilters.push(relation === 'shipment' ? { $or: [{ shipment_id: null }, scoped] } : scoped);
    }
    const workspaceScope = context.permission?.can?.params?.filter;
    if (workspaceScope) {
      sourceFilters.push(
        (await parseJsonTemplate(workspaceScope, {
          state: context.state,
          timezone: context.get('x-timezone'),
          userProvider: createUserProvider({
            db: context.db || this.plugin.db,
            currentUser: context.state.currentUser,
          }),
        })) || workspaceScope,
      );
    }
    context.workspaceReadScope = { $and: sourceFilters };
    params.filter = { $and: [...(filter ? [filter] : []), ...sourceFilters] };
    await next();
  };

  private readonly list = async (context: WorkspaceContext, next: Next): Promise<void> => {
    const params = context.action.params;
    if (params.workspaceGroupByRun !== true && params.workspaceGroupByRun !== 'true') {
      await actions.list(context, next);
      return;
    }
    const page = Number(params.page ?? 1);
    const pageSize = Number(params.pageSize ?? 20);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 200) {
      context.throw(400, 'Неверный номер страницы или количество рейсов на странице.');
      return;
    }
    context.body = await this.readModel.findPage({
      filter: objectFilter(params.filter) || {},
      scopeFilter: context.workspaceReadScope || {},
      fields: params.fields || ['id'],
      sort: params.sort || [],
      page,
      pageSize,
    });
    context.paginate = true;
    await next();
  };

  private validateQueryFields(
    context: Context,
    filter: Record<string, unknown> | undefined,
    allowed: Set<string>,
  ): void {
    for (const [key, value] of Object.entries(filter || {})) {
      if (['$and', '$or', '$not'].includes(key)) {
        const items = Array.isArray(value) ? value : [value];
        for (const item of items) this.validateQueryFields(context, objectFilter(item), allowed);
      } else if (!allowed.has(key.split('.')[0])) {
        context.throw(403, 'Нет прав для фильтрации по выбранному полю.');
      }
    }
  }

  private readonly search = async (context: WorkspaceContext, next: Next): Promise<void> => {
    const params = context.action.params;
    const term = params.searchTerm ?? params.term;
    if (typeof term !== 'string' || term.trim().length < 3 || term.trim().length > 100) {
      context.throw(400, 'Введите от 3 до 100 символов для поиска.');
      return;
    }
    let requested: unknown = params.searchFields;
    try {
      requested = typeof requested === 'string' ? JSON.parse(requested) : requested;
    } catch (error) {
      context.throw(400, 'Неверный список полей поиска.');
    }
    if (requested !== undefined && (!Array.isArray(requested) || requested.some((name) => typeof name !== 'string'))) {
      context.throw(400, 'Неверный список полей поиска.');
    }
    const permitted = context.permission?.can ? permittedFields(context.permission.can) : null;
    const fields = LOGISTICS_WORKSPACE_FIELD_SOURCES.filter(
      (field) =>
        field.searchable &&
        (!permitted || permitted.has(field.name)) &&
        (!Array.isArray(requested) || requested.includes(field.name)),
    );
    if (!fields.length) {
      context.throw(422, 'Нет доступных полей для поиска.');
    }
    const numberTerm = term.trim().replace(/^№\s*/, '');
    const numericValue = /^\d+(?:[.,]\d+)?$/.test(numberTerm) ? Number(numberTerm.replace(',', '.')) : null;
    const numeric = numericValue !== null && Number.isFinite(numericValue) ? numericValue : null;
    const clauses = fields.flatMap<Record<string, unknown>>((field) =>
      field.numeric
        ? numeric === null
          ? []
          : [{ [field.name]: { $eq: numeric } }]
        : [{ [field.name]: { $includes: term.trim() } }],
    );
    if (fields.some((field) => field.name === 'status')) {
      const normalizedTerm = term.trim().toLocaleLowerCase('ru-RU');
      const statuses = LOGISTICS_STATUS_VALUES.filter((value) =>
        LOGISTICS_STATUS_LABELS[value].toLocaleLowerCase('ru-RU').includes(normalizedTerm),
      );
      if (statuses.length) clauses.push({ status: { $in: statuses } });
    }
    if (fields.some((field) => field.name === 'transport_type')) {
      const types = TRANSPORT_TYPES.filter((value) =>
        TRANSPORT_TYPE_LABELS[value].toLocaleLowerCase('ru-RU').includes(term.trim().toLocaleLowerCase('ru-RU')),
      );
      if (types.length) clauses.push({ transport_type: { $in: types } });
    }
    params.filter = { $and: [params.filter || {}, { $or: clauses.length ? clauses : [{ id: null }] }] };
    delete params.searchTerm;
    delete params.term;
    delete params.searchFields;
    await this.list(context, next);
  };
}
