/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Context, Next } from '@nocobase/actions';
import type { Plugin } from '@nocobase/server';
import { LEGACY_PROCESS_COLLECTIONS } from '../../../shared/legacyProcessCollections';

const LEGACY_NAMES = new Set<string>(LEGACY_PROCESS_COLLECTIONS);
const ROLE_CATALOGS = new Set(['roles.dataSourcesCollections', 'roles.collections']);

/** NocoBase 2.0.60's role catalog ignores its hidden filter and enumerates runtime collections directly. */
export class LegacyProcessCollectionsCatalog {
  constructor(private readonly plugin: Plugin) {}

  register(): void {
    this.plugin.app.resourceManager.use((context, next) => this.filter(context as Context, next), {
      tag: 'log-company.legacy-process-catalog',
      after: 'acl',
    });
  }

  private readonly filter = async (context: Context, next: Next): Promise<void> => {
    await next();
    if (!ROLE_CATALOGS.has(context.action.resourceName) || context.action.actionName !== 'list') return;
    const filter: unknown = context.action.params.filter;
    if (filter && typeof filter === 'object' && 'dataSourceKey' in filter && filter.dataSourceKey !== 'main') return;
    // A deployment still using the original process model must retain its existing role configuration UI.
    if (this.plugin.db.getCollection('customs_processes')) return;
    const body: unknown = context.body;
    if (!body || typeof body !== 'object' || !('rows' in body) || !Array.isArray(body.rows)) return;
    const rows = body.rows.filter(
      (row: unknown) => !row || typeof row !== 'object' || !('name' in row) || !LEGACY_NAMES.has(String(row.name)),
    );
    const removed = body.rows.length - rows.length;
    if (!removed) return;
    const count = 'count' in body && typeof body.count === 'number' ? Math.max(0, body.count - removed) : rows.length;
    const pageSize = Number(context.action.params.pageSize || 20);
    context.body = { ...body, rows, count, totalPage: Math.ceil(count / pageSize) };
  };
}
