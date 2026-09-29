/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  type IndexedSearchTableResource,
  SEARCH_DEBOUNCE_MS,
  TableIndexedSearchController,
} from '../TableIndexedSearchController';

class ResourceStub implements IndexedSearchTableResource {
  params: Record<string, unknown> = { page: 3, pageSize: 20 };
  actionName = 'list';
  data: unknown[] = [];
  meta: Record<string, unknown> = {};
  runAction = vi.fn(async (): Promise<{ data: unknown[]; meta?: Record<string, unknown> }> => ({ data: [] }));

  getRequestOptions() {
    return { params: this.params };
  }

  getRequestParameter(key: string) {
    return this.params[key];
  }

  addRequestParameter(key: string, value: unknown) {
    this.params[key] = value;
    return this;
  }

  removeRequestParameter(key: string) {
    delete this.params[key];
    return this;
  }

  setRefreshAction(actionName: string) {
    this.actionName = actionName;
  }

  setPage(page: number) {
    this.params.page = page;
  }

  setData(data: unknown[]) {
    this.data = data;
    return this;
  }

  setMeta(meta: Record<string, unknown> = {}) {
    this.meta = meta;
    return this;
  }
}

function deferred<T>() {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

describe('TableIndexedSearchController', () => {
  it('debounces valid input for 325 milliseconds', async () => {
    vi.useFakeTimers();
    try {
      const resource = new ResourceStub();
      const controller = new TableIndexedSearchController(resource, () => undefined);

      controller.schedule('abc');
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 1);
      expect(resource.runAction).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(resource.runAction).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not search one or two characters and clears an active search', async () => {
    const resource = new ResourceStub();
    resource.params.searchTerm = '762';
    resource.actionName = 'searchCurrentCollection';
    const controller = new TableIndexedSearchController(resource, () => undefined, 0);

    await controller.submit('76');

    expect(resource.runAction).toHaveBeenCalledWith('list', expect.objectContaining({ method: 'get' }));
    expect(resource.actionName).toBe('list');
    expect(resource.params.searchTerm).toBeUndefined();
    expect(resource.params.page).toBe(1);
  });

  it('does not refresh the table while the first two characters are being entered', async () => {
    const resource = new ResourceStub();
    const controller = new TableIndexedSearchController(resource, () => undefined, 0);

    await controller.submit('a');
    await controller.submit('ab');

    expect(resource.runAction).not.toHaveBeenCalled();
    expect(resource.params.page).toBe(3);
    expect(resource.actionName).toBe('list');
  });

  it('applies valid indexed results to the current table resource', async () => {
    const resource = new ResourceStub();
    resource.runAction.mockResolvedValue({ data: [{ id: 15 }], meta: { count: 1, page: 1, pageSize: 20 } });
    const controller = new TableIndexedSearchController(resource, () => undefined, 0);

    await controller.submit('762');

    expect(resource.actionName).toBe('searchCurrentCollection');
    expect(resource.params.searchTerm).toBe('762');
    expect(resource.data).toEqual([{ id: 15 }]);
    expect(resource.meta).toMatchObject({ count: 1, page: 1 });
  });

  it('passes configured searchable fields to the indexed action', async () => {
    const resource = new ResourceStub();
    const controller = new TableIndexedSearchController(resource, () => undefined, 0, {
      searchableFieldNames: ['vehicle', 'manager_comment'],
    });

    await controller.submit('762');

    expect(resource.params.searchFields).toBe('["vehicle","manager_comment"]');
    expect(resource.runAction).toHaveBeenCalledWith(
      'searchCurrentCollection',
      expect.objectContaining({
        params: expect.objectContaining({ searchFields: '["vehicle","manager_comment"]' }),
      }),
    );
  });

  it('does not expose table-wide loading while a search is running', async () => {
    const resource = new ResourceStub();
    const request = deferred<{ data: unknown[] }>();
    resource.runAction.mockReturnValue(request.promise);
    const states: Array<{ loading: boolean; error?: unknown }> = [];
    const controller = new TableIndexedSearchController(resource, (state) => states.push(state), 0);

    const search = controller.submit('ЧЕМОДАНЫ');

    expect(states).toEqual([{ loading: true }]);
    expect(resource.params.page).toBe(1);
    request.resolve({ data: [{ id: 1 }] });
    await search;
    expect(states).toEqual([{ loading: true }, { loading: false }]);
  });

  it('preserves active search parameters when the React controller is remounted', async () => {
    const resource = new ResourceStub();
    resource.params.searchTerm = 'ЧЕМОДАНЫ';
    resource.params.searchFields = '["shipments"]';
    resource.actionName = 'searchCurrentCollection';
    const controller = new TableIndexedSearchController(resource, () => undefined, 0);

    controller.dispose();

    expect(resource.actionName).toBe('searchCurrentCollection');
    expect(resource.params.searchTerm).toBe('ЧЕМОДАНЫ');
    expect(resource.params.searchFields).toBe('["shipments"]');
  });

  it('restores the ordinary table after clearing a search following a controller remount', async () => {
    const resource = new ResourceStub();
    resource.params.searchTerm = 'ЧЕМОДАНЫ';
    resource.params.searchFields = '["shipments"]';
    resource.actionName = 'searchCurrentCollection';
    new TableIndexedSearchController(resource, () => undefined, 0).dispose();
    const remountedController = new TableIndexedSearchController(resource, () => undefined, 0);

    await remountedController.submit('');

    expect(resource.runAction).toHaveBeenCalledWith('list', expect.objectContaining({ method: 'get' }));
    expect(resource.actionName).toBe('list');
    expect(resource.params.searchTerm).toBeUndefined();
    expect(resource.params.searchFields).toBeUndefined();
    expect(resource.params.page).toBe(1);
  });

  it('silently handles a canceled request and leaves loading state', async () => {
    const resource = new ResourceStub();
    resource.runAction.mockRejectedValue(Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' }));
    const states: Array<{ loading: boolean; error?: unknown }> = [];
    const controller = new TableIndexedSearchController(resource, (state) => states.push(state), 0);

    await controller.submit('ЧЕМОДАНЫ');

    expect(states).toEqual([{ loading: true }, { loading: false }]);
    expect(states.some((state) => state.error)).toBe(false);
  });

  it('does not cancel list restoration when a short query is erased quickly', async () => {
    const resource = new ResourceStub();
    resource.params.searchTerm = 'missing';
    resource.actionName = 'searchCurrentCollection';
    const listRequest = deferred<{ data: unknown[] }>();
    resource.runAction.mockReturnValue(listRequest.promise);
    const states: Array<{ loading: boolean; error?: unknown }> = [];
    const controller = new TableIndexedSearchController(resource, (state) => states.push(state), 0);

    const restore = controller.submit('mi');
    await controller.submit('m');
    await controller.submit('');

    expect(resource.runAction).toHaveBeenCalledOnce();
    expect(resource.runAction).toHaveBeenCalledWith('list', expect.objectContaining({ method: 'get' }));
    listRequest.resolve({ data: [{ id: 3 }] });
    await restore;

    expect(resource.data).toEqual([{ id: 3 }]);
    expect(states.at(-1)).toEqual({ loading: false });
    expect(states.some((state) => state.error)).toBe(false);
  });

  it('restores the list after an in-flight empty-result search is canceled by quick clearing', async () => {
    const resource = new ResourceStub();
    const searchRequest = deferred<{ data: unknown[] }>();
    const listRequest = deferred<{ data: unknown[] }>();
    resource.runAction.mockImplementation((actionName: string) =>
      actionName === 'list' ? listRequest.promise : searchRequest.promise,
    );
    const states: Array<{ loading: boolean; error?: unknown }> = [];
    const controller = new TableIndexedSearchController(resource, (state) => states.push(state), 0);

    const search = controller.submit('missing');
    const restore = controller.submit('mi');
    await controller.submit('');
    listRequest.resolve({ data: [{ id: 4 }] });
    await restore;
    searchRequest.resolve({ data: [] });
    await search;

    expect(resource.data).toEqual([{ id: 4 }]);
    expect(resource.actionName).toBe('list');
    expect(resource.params.searchTerm).toBeUndefined();
    expect(states.at(-1)).toEqual({ loading: false });
    expect(states.some((state) => state.error)).toBe(false);
  });

  it('does not apply an outdated response after a newer search', async () => {
    const resource = new ResourceStub();
    const oldRequest = deferred<{ data: unknown[] }>();
    const currentRequest = deferred<{ data: unknown[] }>();
    resource.runAction.mockImplementation((_actionName: string, options: Record<string, unknown>) => {
      const params = options.params as Record<string, unknown>;
      return params.searchTerm === 'first' ? oldRequest.promise : currentRequest.promise;
    });
    const controller = new TableIndexedSearchController(resource, () => undefined, 0);

    const first = controller.submit('first');
    const second = controller.submit('second');
    currentRequest.resolve({ data: [{ id: 2 }] });
    await second;
    oldRequest.resolve({ data: [{ id: 1 }] });
    await first;

    expect(resource.data).toEqual([{ id: 2 }]);
  });

  it('does not apply an outdated list restoration after search becomes active again', async () => {
    const resource = new ResourceStub();
    resource.params.searchTerm = '762';
    resource.actionName = 'searchCurrentCollection';
    const listRequest = deferred<{ data: unknown[] }>();
    const searchRequest = deferred<{ data: unknown[] }>();
    resource.runAction.mockImplementation((actionName: string) =>
      actionName === 'list' ? listRequest.promise : searchRequest.promise,
    );
    const controller = new TableIndexedSearchController(resource, () => undefined, 0);

    const clear = controller.submit('76');
    const search = controller.submit('Asia');
    searchRequest.resolve({ data: [{ id: 2 }] });
    await search;
    listRequest.resolve({ data: [{ id: 1 }] });
    await clear;

    expect(resource.data).toEqual([{ id: 2 }]);
    expect(resource.actionName).toBe('searchCurrentCollection');
  });
});
