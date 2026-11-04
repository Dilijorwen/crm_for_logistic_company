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
import type { ChatDetails } from './types';

interface ChatDetailsState {
  chatId: string | null;
  details: ChatDetails | null;
  loading: boolean;
  error: unknown;
}

export function useChatDetails(chatId: string | null) {
  const api = useAPIClient();
  const [state, setState] = useState<ChatDetailsState>({
    chatId: null,
    details: null,
    loading: false,
    error: null,
  });
  const requestId = useRef(0);

  const refresh = useCallback(
    async (propagateError = true) => {
      if (!chatId) {
        setState({ chatId: null, details: null, loading: false, error: null });
        return;
      }
      const currentRequest = requestId.current + 1;
      requestId.current = currentRequest;
      setState((previous) => ({
        chatId,
        details: previous.chatId === chatId ? previous.details : null,
        loading: true,
        error: null,
      }));
      try {
        const result = await getChat(api, chatId);
        if (requestId.current === currentRequest) {
          setState({ chatId, details: result, loading: false, error: null });
        }
      } catch (requestError) {
        if (requestId.current === currentRequest) {
          setState((previous) => ({ ...previous, loading: false, error: requestError }));
        }
        if (propagateError) throw requestError;
      }
    },
    [api, chatId],
  );

  useEffect(() => {
    refresh(false);
    return () => {
      requestId.current += 1;
    };
  }, [refresh]);

  const isCurrentChat = state.chatId === chatId;
  return {
    details: isCurrentChat ? state.details : null,
    loading: Boolean(chatId) && (!isCurrentChat || state.loading),
    error: isCurrentChat ? state.error : null,
    refresh,
  };
}
