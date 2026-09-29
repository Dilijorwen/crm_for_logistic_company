/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Context, Next } from '@nocobase/actions';
import {
  AuthorizeSearchConfigurationChange,
  SearchConfigurationForbiddenError,
} from '../../application/AuthorizeSearchConfigurationChange';

const MUTATING_ACTIONS = new Set([
  'save',
  'destroy',
  'duplicate',
  'attach',
  'move',
  'patch',
  'remove',
  'insertAdjacent',
  'create',
  'update',
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function identifier(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function targetUids(context: Context): string[] {
  const params = asRecord(context.action.params);
  const requestBody = asRecord((context as Context & { request?: { body?: unknown } }).request?.body);
  const values = asRecord(params.values ?? requestBody);
  const options = asRecord(requestBody.options);
  return [
    params.uid,
    params.filterByTk,
    params.sourceId,
    params.targetId,
    params.parentId,
    values.uid,
    requestBody.uid,
    options.uid,
  ]
    .map(identifier)
    .filter((value): value is string => Boolean(value));
}

export class SearchConfigurationGuard {
  constructor(private readonly authorize: AuthorizeSearchConfigurationChange) {}

  readonly handle = async (context: Context, next: Next): Promise<void> => {
    if (
      context.action.params.resourceName !== 'flowModels' ||
      !MUTATING_ACTIONS.has(context.action.params.actionName)
    ) {
      await next();
      return;
    }
    const state = (context as Context & { state?: { currentRole?: unknown; currentRoles?: unknown } }).state;
    const roles = Array.isArray(state?.currentRoles)
      ? state.currentRoles.filter((role): role is string => typeof role === 'string')
      : typeof state?.currentRole === 'string'
        ? [state.currentRole]
        : [];
    try {
      await this.authorize.execute({
        roles,
        payload:
          asRecord(context.action.params).values ??
          (context as Context & { request?: { body?: unknown } }).request?.body,
        modelUids: targetUids(context),
      });
    } catch (error) {
      if (error instanceof SearchConfigurationForbiddenError) {
        context.throw(403, 'Только пользователь root может изменять настройки поиска.');
        return;
      }
      throw error;
    }
    await next();
  };
}
