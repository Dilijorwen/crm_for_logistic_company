/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import actions, { type Context, type Next } from '@nocobase/actions';
import type { Plugin } from '@nocobase/server';
import { SearchCurrentCollection } from '../../application/SearchCurrentCollection';
import { CollectionSearchError } from '../../domain/search/SearchErrors';
import { NocoBaseCollectionSearchGateway } from '../../infrastructure/persistence/nocobase/NocoBaseCollectionSearchGateway';
import { NocoBaseSearchIndexRepository } from '../../infrastructure/persistence/nocobase/NocoBaseSearchIndexRepository';
import { COLLECTION_SEARCH_OPERATOR } from '../../infrastructure/persistence/nocobase/NocoBaseIndexedSearchOperator';

export const COLLECTION_SEARCH_ACTION = 'searchCurrentCollection';
const ERROR_MESSAGES: Record<CollectionSearchError['code'], string> = {
  SEARCH_TERM_TOO_SHORT: 'Введите не менее 3 символов',
  SEARCH_TERM_TOO_LONG: 'Введите не более 100 символов',
  COLLECTION_NOT_FOUND: 'Текущая коллекция не найдена',
  NO_SEARCHABLE_FIELDS: 'В текущей коллекции нет доступных для поиска полей',
  INVALID_SEARCH_FIELDS: 'Список полей поиска имеет неверный формат',
  INVALID_FILTER: 'Фильтр текущей таблицы имеет неверный формат',
};
const MAX_CONFIGURED_SEARCH_FIELDS = 200;
const MAX_FIELD_NAME_LENGTH = 128;

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

function objectFilter(value: unknown): Record<string, unknown> | undefined {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string' || !value) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch (error) {
    throw new CollectionSearchError('INVALID_FILTER', 'The current table filter is invalid.');
  }
}

function permittedFieldNames(context: Context): string[] | undefined {
  const permission = (context as Context & { permission?: { can?: { params?: { fields?: unknown } } } }).permission;
  const fields = permission?.can?.params?.fields;
  return Array.isArray(fields) ? fields.filter((field): field is string => typeof field === 'string') : undefined;
}

function requestedFieldNames(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      throw new CollectionSearchError('INVALID_SEARCH_FIELDS', 'Configured search fields are invalid.');
    }
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length > MAX_CONFIGURED_SEARCH_FIELDS ||
    parsed.some((field) => typeof field !== 'string' || !field || field.length > MAX_FIELD_NAME_LENGTH)
  ) {
    throw new CollectionSearchError('INVALID_SEARCH_FIELDS', 'Configured search fields are invalid.');
  }
  return Array.from(new Set(parsed));
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
      const plan = await new SearchCurrentCollection(gateway).execute({
        term: params.searchTerm ?? params.term,
        permittedFieldNames: permittedFieldNames(context),
        requestedFieldNames: requestedFieldNames(params.searchFields),
      });
      const indexedFilter = {
        [`${plan.keyFields[0]}.${COLLECTION_SEARCH_OPERATOR}`]: plan,
      };
      const currentFilter = objectFilter(params.filter);
      context.action.params.filter = currentFilter ? { $and: [currentFilter, indexedFilter] } : indexedFilter;
      delete context.action.params.searchTerm;
      delete context.action.params.term;
      delete context.action.params.searchFields;
      await actions.list(context, next);
    } catch (error) {
      if (error instanceof CollectionSearchError) {
        const status = error.code === 'COLLECTION_NOT_FOUND' ? 404 : error.code === 'NO_SEARCHABLE_FIELDS' ? 422 : 400;
        context.throw(status, ERROR_MESSAGES[error.code], { code: error.code });
        return;
      }
      this.plugin.app.logger.error('[collection-search] Search failed', {
        error: error instanceof Error ? error.message : String(error),
        collection: context.action?.resourceName,
      });
      context.throw(500, 'Не удалось выполнить поиск');
    }
  }
}
