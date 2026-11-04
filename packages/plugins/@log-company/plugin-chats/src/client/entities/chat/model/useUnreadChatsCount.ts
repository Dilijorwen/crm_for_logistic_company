/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useAPIClient, type APIClient } from '@nocobase/client';
import { useMemo, useSyncExternalStore } from 'react';
import { CHAT_LIMITS } from '../../../../shared/chatLimits';
import { getUnreadChatsCount } from '../api/chatsApi';
import { CHAT_REFRESH_EVENT } from '../lib/chatEvents';
import { UnreadChatsCountStore } from './unreadChatsCountStore';

const storesByApiClient = new WeakMap<APIClient, UnreadChatsCountStore>();

function attachBrowserPolling(refresh: () => void): () => void {
  const refreshWhenVisible = () => {
    if (document.visibilityState === 'visible') {
      refresh();
    }
  };
  const interval = window.setInterval(refresh, CHAT_LIMITS.pollingIntervalMilliseconds);
  window.addEventListener(CHAT_REFRESH_EVENT, refresh);
  document.addEventListener('visibilitychange', refreshWhenVisible);

  return () => {
    window.clearInterval(interval);
    window.removeEventListener(CHAT_REFRESH_EVENT, refresh);
    document.removeEventListener('visibilitychange', refreshWhenVisible);
  };
}

function getUnreadChatsCountStore(api: APIClient): UnreadChatsCountStore {
  const existingStore = storesByApiClient.get(api);
  if (existingStore) {
    return existingStore;
  }
  const store = new UnreadChatsCountStore(() => getUnreadChatsCount(api), attachBrowserPolling);
  storesByApiClient.set(api, store);
  return store;
}

export function useUnreadChatsCount() {
  const api = useAPIClient();
  const store = useMemo(() => getUnreadChatsCountStore(api), [api]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  return { ...snapshot, refresh: store.refresh };
}
