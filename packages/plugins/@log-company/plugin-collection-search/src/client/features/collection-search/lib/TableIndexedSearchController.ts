/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export const MINIMUM_SEARCH_LENGTH = 3;
export const SEARCH_DEBOUNCE_MS = 325;
const SEARCH_ACTION = 'searchCurrentCollection';
const DEFAULT_ACTION = 'list';

interface SearchResourceResult {
  data: unknown[];
  meta?: Record<string, unknown>;
}

export interface IndexedSearchTableResource {
  getRequestOptions(): { params?: Record<string, unknown> };
  getRequestParameter(key: string): unknown;
  addRequestParameter(key: string, value: unknown): IndexedSearchTableResource;
  removeRequestParameter(key: string): IndexedSearchTableResource;
  setRefreshAction(actionName: string): void;
  setPage(page: number): unknown;
  setData(data: unknown[]): IndexedSearchTableResource;
  setMeta(meta?: Record<string, unknown>): IndexedSearchTableResource;
  runAction(actionName: string, options: Record<string, unknown>): Promise<SearchResourceResult>;
}

export interface SearchStateListener {
  (state: { loading: boolean; error?: unknown }): void;
}

interface TableIndexedSearchOptions {
  searchableFieldNames?: string[];
}

function normalizedTerm(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function isCanceledRequest(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === 'CanceledError' || error.message.toLowerCase() === 'canceled';
  }
  if (error === null || typeof error !== 'object' || Array.isArray(error)) {
    return false;
  }
  const candidate = error as Record<string, unknown>;
  return candidate.code === 'ERR_CANCELED' || candidate.name === 'CanceledError' || candidate.message === 'canceled';
}

export class TableIndexedSearchController {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private abortController: AbortController | undefined;
  private requestSequence = 0;

  constructor(
    private readonly resource: IndexedSearchTableResource,
    private readonly onStateChange: SearchStateListener,
    private readonly debounceMs = SEARCH_DEBOUNCE_MS,
    private readonly options: TableIndexedSearchOptions = {},
  ) {}

  schedule(value: string): void {
    this.clearTimer();
    const term = normalizedTerm(value);
    if (term.length < MINIMUM_SEARCH_LENGTH) {
      this.clearSearch().catch(() => undefined);
      return;
    }
    this.timer = setTimeout(() => {
      this.performSearch(term).catch(() => undefined);
    }, this.debounceMs);
  }

  async submit(value: string): Promise<void> {
    this.clearTimer();
    const term = normalizedTerm(value);
    if (term.length < MINIMUM_SEARCH_LENGTH) {
      await this.clearSearch();
      return;
    }
    await this.performSearch(term);
  }

  async clearSearch(): Promise<void> {
    this.clearTimer();
    this.cancelActiveRequest();
    const activeSearchTerm = this.resource.getRequestParameter('searchTerm');
    const hadSearch = typeof activeSearchTerm === 'string' && activeSearchTerm.length >= MINIMUM_SEARCH_LENGTH;
    if (!hadSearch) {
      return;
    }
    this.resource.setRefreshAction(DEFAULT_ACTION);
    this.resource.removeRequestParameter('searchTerm');
    this.resource.removeRequestParameter('searchFields');
    this.resource.addRequestParameter('page', 1);
    this.onStateChange({ loading: false });
    await this.restoreList();
  }

  dispose(): void {
    this.clearTimer();
    this.cancelActiveRequest();
  }

  private async performSearch(term: string): Promise<void> {
    this.cancelActiveRequest();
    const sequence = this.requestSequence;
    const abortController = new AbortController();
    this.abortController = abortController;
    this.resource.setRefreshAction(SEARCH_ACTION);
    this.resource.addRequestParameter('searchTerm', term);
    if (this.options.searchableFieldNames) {
      this.resource.addRequestParameter('searchFields', JSON.stringify(this.options.searchableFieldNames));
    } else {
      this.resource.removeRequestParameter('searchFields');
    }
    this.resource.addRequestParameter('page', 1);
    this.onStateChange({ loading: true });
    try {
      const currentParams = this.resource.getRequestOptions().params || {};
      const result = await this.resource.runAction(SEARCH_ACTION, {
        method: 'get',
        params: { ...currentParams, searchTerm: term, page: 1 },
        signal: abortController.signal,
      });
      if (sequence !== this.requestSequence) {
        return;
      }
      this.resource.setData(result.data).setMeta(result.meta);
      this.onStateChange({ loading: false });
    } catch (error) {
      if (sequence !== this.requestSequence) {
        return;
      }
      if (isCanceledRequest(error)) {
        this.onStateChange({ loading: false });
        return;
      }
      this.resource.setRefreshAction(DEFAULT_ACTION);
      this.resource.removeRequestParameter('searchTerm');
      this.resource.removeRequestParameter('searchFields');
      this.onStateChange({ loading: false, error });
    } finally {
      if (sequence === this.requestSequence) {
        this.abortController = undefined;
      }
    }
  }

  private async restoreList(): Promise<void> {
    const sequence = this.requestSequence;
    const abortController = new AbortController();
    this.abortController = abortController;
    this.onStateChange({ loading: true });
    try {
      const currentParams = this.resource.getRequestOptions().params || {};
      const result = await this.resource.runAction(DEFAULT_ACTION, {
        method: 'get',
        params: { ...currentParams, page: 1 },
        signal: abortController.signal,
      });
      if (sequence !== this.requestSequence) {
        return;
      }
      this.resource.setData(result.data).setMeta(result.meta);
      this.onStateChange({ loading: false });
    } catch (error) {
      if (sequence !== this.requestSequence) {
        return;
      }
      if (isCanceledRequest(error)) {
        this.onStateChange({ loading: false });
        return;
      }
      this.onStateChange({ loading: false, error });
    } finally {
      if (sequence === this.requestSequence) {
        this.abortController = undefined;
      }
    }
  }

  private cancelActiveRequest(): void {
    this.requestSequence += 1;
    this.abortController?.abort();
    this.abortController = undefined;
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}
