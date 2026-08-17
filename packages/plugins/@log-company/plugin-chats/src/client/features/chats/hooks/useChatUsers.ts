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
import { searchChatUsers } from '../api/chatsApi';
import type { ChatUser } from '../model/types';

export function useChatUsers(query = '') {
  const api = useAPIClient();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setLoading(true);
    try {
      const result = await searchChatUsers(api, query);
      if (requestId.current === currentRequest) {
        setUsers(result);
        setError(null);
      }
    } catch (requestError) {
      if (requestId.current === currentRequest) {
        setUsers([]);
        setError(requestError);
      }
    } finally {
      if (requestId.current === currentRequest) {
        setLoading(false);
      }
    }
  }, [api, query]);

  useEffect(() => {
    refresh();
    return () => {
      requestId.current += 1;
    };
  }, [refresh]);

  return { users, loading, error, refresh };
}
