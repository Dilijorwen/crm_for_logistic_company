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
import { uploadChatAttachments } from '../api/attachmentsApi';
import { deleteChatMessage, listChatMessages, markChatAsRead, sendChatMessage } from '../api/messagesApi';
import { dispatchChatRefresh } from '../lib/chatEvents';
import type { ChatMessage } from '../model/types';

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return Array.from(byId.values()).sort((left, right) => {
    const dateComparison = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    return dateComparison || left.id.localeCompare(right.id);
  });
}

export function useChatMessages(chatId: string | null) {
  const api = useAPIClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);
  const olderRequestId = useRef(0);
  const activeChatId = useRef(chatId);
  activeChatId.current = chatId;

  const markRead = useCallback(async () => {
    if (!chatId) return true;
    try {
      await markChatAsRead(api, chatId);
      dispatchChatRefresh();
      return true;
    } catch (requestError) {
      setError(requestError);
      return false;
    }
  }, [api, chatId]);

  const loadInitial = useCallback(async () => {
    if (!chatId) {
      setMessages([]);
      setNextCursor(null);
      return true;
    }
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setLoading(true);
    try {
      const page = await listChatMessages(api, chatId, null);
      if (requestId.current === currentRequest) {
        setMessages([...page.items].reverse());
        setNextCursor(page.nextCursor);
        setError(null);
        await markRead();
      }
    } catch (requestError) {
      if (requestId.current === currentRequest) setError(requestError);
      return false;
    } finally {
      if (requestId.current === currentRequest) setLoading(false);
    }
    return true;
  }, [api, chatId, markRead]);

  const refreshLatest = useCallback(async () => {
    if (!chatId) return true;
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    try {
      const page = await listChatMessages(api, chatId, null);
      if (requestId.current === currentRequest) {
        setMessages((current) => mergeMessages(current, page.items));
        setError(null);
        await markRead();
      }
    } catch (requestError) {
      if (requestId.current === currentRequest) {
        setError(requestError);
      }
      return false;
    }
    return true;
  }, [api, chatId, markRead]);

  const loadOlder = useCallback(async () => {
    if (!chatId || !nextCursor || loadingOlder) return false;
    const currentRequest = requestId.current;
    const currentOlderRequest = olderRequestId.current + 1;
    olderRequestId.current = currentOlderRequest;
    setLoadingOlder(true);
    try {
      const page = await listChatMessages(api, chatId, nextCursor);
      if (requestId.current !== currentRequest || activeChatId.current !== chatId) {
        return false;
      }
      setMessages((current) => mergeMessages(current, page.items));
      setNextCursor(page.nextCursor);
      setError(null);
      return true;
    } catch (requestError) {
      if (requestId.current === currentRequest) {
        setError(requestError);
      }
      throw requestError;
    } finally {
      if (olderRequestId.current === currentOlderRequest) {
        setLoadingOlder(false);
      }
    }
  }, [api, chatId, loadingOlder, nextCursor]);

  const send = useCallback(
    async (text: string, files: File[]) => {
      if (!chatId) return;
      const message = files.length
        ? await uploadChatAttachments(api, chatId, text, files)
        : await sendChatMessage(api, chatId, text);
      if (activeChatId.current === chatId) {
        setMessages((current) => mergeMessages(current, [message]));
      }
      dispatchChatRefresh();
    },
    [api, chatId],
  );

  const remove = useCallback(
    async (messageId: string) => {
      await deleteChatMessage(api, messageId);
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, text: null, attachments: [], deletedAt: new Date().toISOString(), canDelete: false }
            : message,
        ),
      );
      dispatchChatRefresh();
    },
    [api],
  );

  useEffect(() => {
    setMessages([]);
    setNextCursor(null);
    setLoadingOlder(false);
    setError(null);
    loadInitial();
    return () => {
      requestId.current += 1;
      olderRequestId.current += 1;
    };
  }, [loadInitial]);

  useEffect(() => {
    const runRefresh = () => {
      if (document.visibilityState === 'visible') refreshLatest();
    };
    const interval = window.setInterval(runRefresh, CHAT_LIMITS.pollingIntervalMilliseconds);
    document.addEventListener('visibilitychange', runRefresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', runRefresh);
    };
  }, [refreshLatest]);

  return {
    messages,
    loading,
    loadingOlder,
    hasOlder: Boolean(nextCursor),
    error,
    loadInitial,
    refreshLatest,
    loadOlder,
    send,
    remove,
  };
}
