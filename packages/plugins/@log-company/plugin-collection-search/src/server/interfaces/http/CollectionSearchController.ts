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
import { SearchCurrentCollection } from '../../application/SearchCurrentCollection';
import { CollectionSearchError } from '../../domain/search/SearchErrors';
import { NocoBaseCollectionSearchGateway } from '../../infrastructure/persistence/nocobase/NocoBaseCollectionSearchGateway';
import { NocoBaseSearchIndexRepository } from '../../infrastructure/persistence/nocobase/NocoBaseSearchIndexRepository';

export const COLLECTION_SEARCH_ACTION = 'searchCurrentCollection';
const NAMESPACE = '@log-company/plugin-collection-search';

interface SearchDataSource {
  name: string;
  resourceManager: {
    registerActionHandler(name: string, handler: (context: Context, next: Next) => Promise<void>): void;
  };
  acl: {
    getAvailableAction(name: string): { options: { aliases?: string | string[] } } | undefined;
    setAvailableAction(name: string, options: Record<string, unknown>): void;
  };
  collectionManager: {
    db?: unknown;
  };
}

function queryParams(context: Context): Record<string, unknown> {
  const params = context.action?.params;
  return params !== null && typeof params === 'object' && !Array.isArray(params)
    ? (params as Record<string, unknown>)
    : {};
}

function aliases(value: string | string[] | undefined): string[] {
  return value ? (Array.isArray(value) ? value : [value]) : [];
}

export class CollectionSearchController {
  constructor(
    private readonly plugin: Plugin,
    private readonly indexRepository: NocoBaseSearchIndexRepository,
  ) {}

  register(dataSource: SearchDataSource): void {
    dataSource.resourceManager.registerActionHandler(COLLECTION_SEARCH_ACTION, async (context, next) => {
      await this.search(context, next, dataSource);
    });
    const viewAction = dataSource.acl.getAvailableAction('view');
    if (viewAction) {
      dataSource.acl.setAvailableAction('view', {
        ...viewAction.options,
        aliases: Array.from(new Set([...aliases(viewAction.options.aliases), COLLECTION_SEARCH_ACTION])),
      });
    }
  }

  private async search(context: Context, next: Next, dataSource: SearchDataSource): Promise<void> {
    try {
      const params = queryParams(context);
      const gateway = new NocoBaseCollectionSearchGateway(
        context,
        dataSource as ConstructorParameters<typeof NocoBaseCollectionSearchGateway>[1],
        this.indexRepository,
      );
      context.body = await new SearchCurrentCollection(gateway).execute({
        term: params.term,
        cursor: params.cursor,
        pageSize: params.pageSize,
      });
      await next();
    } catch (error) {
      if (error instanceof CollectionSearchError) {
        const status = error.code === 'COLLECTION_NOT_FOUND' ? 404 : error.code === 'NO_SEARCHABLE_FIELDS' ? 422 : 400;
        context.throw(status, context.t(`errors.${error.code}`, { ns: NAMESPACE }), { code: error.code });
        return;
      }
      this.plugin.app.logger.error('[collection-search] Search failed', {
        error: error instanceof Error ? error.message : String(error),
        collection: context.action?.resourceName,
      });
      context.throw(500, context.t('errors.internal', { ns: NAMESPACE }));
    }
  }
}
