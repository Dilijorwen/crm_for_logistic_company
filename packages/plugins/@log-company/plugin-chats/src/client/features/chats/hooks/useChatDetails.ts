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
import { getChat } from '../api/chatsApi';
import type { ChatDetails } from '../model/types';

export function useChatDetails(chatId: string | null) {
  const api = useAPIClient();
  const [details, setDetails] = useState<ChatDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!chatId) {
      setDetails(null);
      return;
    }
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setLoading(true);
    try {
      const result = await getChat(api, chatId);
      if (requestId.current === currentRequest) {
        setDetails(result);
        setError(null);
      }
    } catch (requestError) {
      if (requestId.current === currentRequest) setError(requestError);
      throw requestError;
    } finally {
      if (requestId.current === currentRequest) setLoading(false);
    }
  }, [api, chatId]);

  useEffect(() => {
    setDetails(null);
    setError(null);
    refresh().catch(setError);
  }, [refresh]);

  return { details, loading, error, refresh };
}
