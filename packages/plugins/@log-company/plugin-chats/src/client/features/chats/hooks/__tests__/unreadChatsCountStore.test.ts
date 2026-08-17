/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { UnreadChatsCountStore } from '../unreadChatsCountStore';

function createPollingHarness() {
  let refresh: (() => void) | undefined;
  const stop = vi.fn();
  const attach = vi.fn((nextRefresh: () => void) => {
    refresh = nextRefresh;
    return stop;
  });

  return {
    attach,
    stop,
    refresh() {
      if (!refresh) {
        throw new Error('Polling has not started');
      }
      refresh();
    },
  };
}

describe('UnreadChatsCountStore', () => {
  it('shares one request and one polling lifecycle between all subscribers', async () => {
    const loadUnreadCount = vi.fn(async () => 3);
    const polling = createPollingHarness();
    const store = new UnreadChatsCountStore(loadUnreadCount, polling.attach);
    const firstListener = vi.fn();
    const secondListener = vi.fn();

    const unsubscribeFirst = store.subscribe(firstListener);
    const unsubscribeSecond = store.subscribe(secondListener);
    await store.refresh();

    expect(polling.attach).toHaveBeenCalledTimes(1);
    expect(loadUnreadCount).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toEqual({ unreadCount: 3, error: null });
    expect(firstListener).toHaveBeenCalledTimes(1);
    expect(secondListener).toHaveBeenCalledTimes(1);

    polling.refresh();
    await store.refresh();
    expect(loadUnreadCount).toHaveBeenCalledTimes(2);

    unsubscribeFirst();
    expect(polling.stop).not.toHaveBeenCalled();
    unsubscribeSecond();
    expect(polling.stop).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent refreshes and recovers after an error', async () => {
    const loadError = new Error('request failed');
    const loadUnreadCount = vi.fn().mockRejectedValueOnce(loadError).mockResolvedValueOnce(7);
    const polling = createPollingHarness();
    const store = new UnreadChatsCountStore(loadUnreadCount, polling.attach);

    const unsubscribe = store.subscribe(vi.fn());
    const firstRefresh = store.refresh();
    const duplicateRefresh = store.refresh();

    expect(firstRefresh).toBe(duplicateRefresh);
    await expect(firstRefresh).resolves.toBe(false);
    expect(loadUnreadCount).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toEqual({ unreadCount: 0, error: loadError });

    await expect(store.refresh()).resolves.toBe(true);
    expect(loadUnreadCount).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot()).toEqual({ unreadCount: 7, error: null });

    unsubscribe();
  });
});
