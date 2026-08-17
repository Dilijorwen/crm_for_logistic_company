/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useAPIClient } from '@nocobase/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CHAT_LIMITS } from '../../../../shared/chatLimits';
import { listChats } from '../api/chatsApi';
import type { ChatListItem } from '../model/types';
import { CHAT_REFRESH_EVENT } from '../lib/chatEvents';

export function useChatList() {
  const api = useAPIClient();
  const [items, setItems] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    try {
      const nextItems = await listChats(api);
      if (requestId.current === currentRequest) {
        setItems(nextItems);
        setError(null);
      }
    } catch (requestError) {
      if (requestId.current === currentRequest) {
        setError(requestError);
      }
      return false;
    } finally {
      if (requestId.current === currentRequest) {
        setLoading(false);
      }
    }
    return true;
  }, [api]);

  useEffect(() => {
    let active = true;
    const runRefresh = () => {
      if (active) refresh();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') runRefresh();
    };
    runRefresh();
    const interval = window.setInterval(runRefresh, CHAT_LIMITS.pollingIntervalMilliseconds);
    window.addEventListener(CHAT_REFRESH_EVENT, runRefresh);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      active = false;
      requestId.current += 1;
      window.clearInterval(interval);
      window.removeEventListener(CHAT_REFRESH_EVENT, runRefresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refresh]);

  return { items, loading, error, refresh };
}
