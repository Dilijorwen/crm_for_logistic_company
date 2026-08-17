/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import { ValidateProcessParents } from '../../application/ValidateProcessParents';
import { ValidateProcessStatusChange } from '../../application/ValidateProcessStatusChange';
import type { ProcessGovernanceRepository } from '../../application/ports/ProcessGovernanceRepository';
import { ProcessGovernanceError } from '../../domain/process/ProcessGovernanceError';
import {
  extractIdentifier,
  normalizeIdentifiers,
  uniqueIdentifiers,
  type EntityId,
} from '../../domain/shared/Identifiers';
import {
  extractProcessRoleNames,
  processGovernanceErrorMessage,
  processGovernanceErrorStatus,
} from '../ProcessGovernanceHttpError';

const PROCESS_COLLECTION = 'customs_processes';
const HISTORY_COLLECTION = 'process_history';
const PARENT_LINKS_COLLECTION = 'customs_process_parent_links';
const PARENT_FIELD = 'parent_processes';
const STATUS_FIELD = 'status';

interface ActionContext {
  state?: {
    currentRole?: unknown;
    currentRoles?: unknown;
  };
  t?: (key: string, options: { ns: string }) => string;
  throw?: (status: number, message: string) => never;
  action?: {
    actionName?: string;
    sourceId?: unknown;
    params?: Record<string, unknown>;
  };
}

export class ProcessGovernancePreActions {
  constructor(
    private readonly plugin: Plugin,
    private readonly repository: ProcessGovernanceRepository,
    private readonly validateParents: ValidateProcessParents,
    private readonly validateStatusChange: ValidateProcessStatusChange,
  ) {}

  register(): void {
    this.plugin.app.resourcer.registerPreActionHandler(`${PROCESS_COLLECTION}:create`, this.processAction);
    this.plugin.app.resourcer.registerPreActionHandler(`${PROCESS_COLLECTION}:update`, this.processAction);
    this.plugin.app.resourcer.registerPreActionHandler(
      `${PROCESS_COLLECTION}.${PARENT_FIELD}:add`,
      this.parentRelation,
    );
    this.plugin.app.resourcer.registerPreActionHandler(
      `${PROCESS_COLLECTION}.${PARENT_FIELD}:set`,
      this.parentRelation,
    );
    this.plugin.app.resourcer.registerPreActionHandler(
      `${PROCESS_COLLECTION}.${PARENT_FIELD}:remove`,
      this.parentRelation,
    );
    this.plugin.app.resourcer.registerPreActionHandler(`${PARENT_LINKS_COLLECTION}:create`, this.parentLink);
    this.plugin.app.resourcer.registerPreActionHandler(`${PARENT_LINKS_COLLECTION}:update`, this.parentLink);
    this.plugin.app.resourcer.registerPreActionHandler(`${HISTORY_COLLECTION}:create`, this.denyHistoryWrite);
    this.plugin.app.resourcer.registerPreActionHandler(`${HISTORY_COLLECTION}:update`, this.denyHistoryWrite);
    this.plugin.app.resourcer.registerPreActionHandler(`${HISTORY_COLLECTION}:destroy`, this.denyHistoryWrite);
  }

  private readonly processAction = async (context: ActionContext, next: () => Promise<unknown>): Promise<void> => {
    await this.mapErrors(context, async () => {
      const values = this.asRecord(context.action?.params?.values);
      const processId =
        context.action?.actionName === 'create'
          ? extractIdentifier(values.id)
          : extractIdentifier(context.action?.params?.filterByTk ?? context.action?.params?.resourceIndex);

      await this.validateStatus(context, values, processId);

      if (Object.prototype.hasOwnProperty.call(values, PARENT_FIELD)) {
        await this.validateParents.execute({
          processId,
          parentIds: normalizeIdentifiers(values[PARENT_FIELD]),
        });
      }
      await next();
    });
  };

  private async validateStatus(
    context: ActionContext,
    values: Record<string, unknown>,
    processId: EntityId | null,
  ): Promise<void> {
    if (!Object.prototype.hasOwnProperty.call(values, STATUS_FIELD)) {
      return;
    }
    const roleNames = extractProcessRoleNames(context);
    if (roleNames === null) {
      return;
    }

    const isCreate = context.action?.actionName === 'create';
    const currentProcess = !isCreate && processId !== null ? await this.repository.findProcess(processId) : null;
    this.validateStatusChange.execute({
      roleNames,
      currentStatus: currentProcess?.status,
      requestedStatus: values[STATUS_FIELD],
      isExistingProcess: Boolean(currentProcess),
    });
  }

  private readonly parentRelation = async (context: ActionContext, next: () => Promise<unknown>): Promise<void> => {
    await this.mapErrors(context, async () => {
      const processId = extractIdentifier(context.action?.sourceId ?? context.action?.params?.associatedIndex);
      if (processId === null || context.action?.actionName === 'remove') {
        await next();
        return;
      }
      const incomingIds = normalizeIdentifiers(
        context.action?.params?.filterByTk ?? context.action?.params?.filterByTks ?? context.action?.params?.values,
      );
      const parentIds =
        context.action?.actionName === 'add'
          ? uniqueIdentifiers([...(await this.repository.getParentIds(processId)), ...incomingIds])
          : incomingIds;
      await this.validateParents.execute({ processId, parentIds });
      await next();
    });
  };

  private readonly parentLink = async (context: ActionContext, next: () => Promise<unknown>): Promise<void> => {
    await this.mapErrors(context, async () => {
      const rawValues = context.action?.params?.values;
      const rows = Array.isArray(rawValues) ? rawValues : [rawValues];
      for (const rawRow of rows) {
        const row = this.asRecord(rawRow);
        const childId = extractIdentifier(row.child_process_id ?? row.childProcessId);
        const parentId = extractIdentifier(row.parent_process_id ?? row.parentProcessId);
        if (childId !== null && parentId !== null) {
          await this.validateParents.execute({ processId: childId, parentIds: [parentId] });
        }
      }
      await next();
    });
  };

  private readonly denyHistoryWrite = async (context: ActionContext): Promise<void> => {
    const message = 'История процессов создается автоматически и недоступна для ручного изменения.';
    if (context.throw) {
      context.throw(403, message);
    }
    throw this.httpError(403, message);
  };

  private async mapErrors(context: ActionContext, work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      if (error instanceof ProcessGovernanceError) {
        const status = processGovernanceErrorStatus(error);
        const message = processGovernanceErrorMessage(context, error);
        if (context.throw) {
          context.throw(status, message);
        }
        throw this.httpError(status, message);
      }
      throw error;
    }
  }

  private httpError(status: number, message: string): Error {
    return Object.assign(new Error(message), { status, statusCode: status });
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
