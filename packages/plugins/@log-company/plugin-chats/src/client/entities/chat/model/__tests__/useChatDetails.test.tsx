/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getChat } from '../../api/chatsApi';
import type { ChatDetails } from '../types';
import { useChatDetails } from '../useChatDetails';

const api = vi.hoisted(() => ({}));
vi.mock('@nocobase/client', () => ({ useAPIClient: () => api }));
vi.mock('../../api/chatsApi', () => ({ getChat: vi.fn() }));

function deferredChat() {
  let complete!: (value: ChatDetails) => void;
  let fail!: (reason: Error) => void;
  const promise = new Promise<ChatDetails>((resolve, reject) => {
    complete = resolve;
    fail = reject;
  });
  return { promise, resolve: complete, reject: fail };
}

function chat(id: string): ChatDetails {
  return {
    id,
    type: 'direct',
    title: id,
    unavailable: false,
    lastMessage: null,
    unreadCount: 0,
    updatedAt: '2026-11-04T00:00:00Z',
    members: [],
    currentRole: 'member',
    canManageMembers: false,
    canDeleteChat: true,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('useChatDetails', () => {
  it('reports loading on every render of the first selection, including before effects run', async () => {
    const request = deferredChat();
    vi.mocked(getChat).mockReturnValue(request.promise);
    const renders: ReturnType<typeof useChatDetails>[] = [];
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => {
        const state = useChatDetails(id);
        renders.push(state);
        return state;
      },
      { initialProps: { id: null } },
    );
    expect(result.current.loading).toBe(false);
    renders.length = 0;
    rerender({ id: 'first' });
    expect(renders.length).toBeGreaterThan(0);
    expect(renders.every((state) => state.loading && !state.error && !state.details)).toBe(true);
    await act(async () => request.resolve(chat('first')));
    expect(result.current.details?.id).toBe('first');
    expect(result.current.loading).toBe(false);
  });

  it('shows a real request error and clears it while retrying', async () => {
    const failed = deferredChat();
    const retry = deferredChat();
    vi.mocked(getChat).mockReturnValueOnce(failed.promise).mockReturnValueOnce(retry.promise);
    const { result } = renderHook(() => useChatDetails('first'));
    const error = new Error('Not found');
    await act(async () => failed.reject(error));
    expect(result.current.error).toBe(error);
    expect(result.current.loading).toBe(false);
    let refresh: Promise<void>;
    act(() => {
      refresh = result.current.refresh();
    });
    expect(result.current.error).toBe(null);
    expect(result.current.loading).toBe(true);
    await act(async () => {
      retry.resolve(chat('first'));
      await refresh;
    });
    expect(result.current.details?.id).toBe('first');
  });

  it.each(['resolve', 'reject'] as const)('ignores a late %s from the previous chat', async (outcome) => {
    const first = deferredChat();
    const second = deferredChat();
    vi.mocked(getChat).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(({ id }) => useChatDetails(id), { initialProps: { id: 'first' } });
    rerender({ id: 'second' });
    await act(async () => second.resolve(chat('second')));
    await act(async () => {
      if (outcome === 'resolve') first.resolve(chat('first'));
      else first.reject(new Error('Old error'));
    });
    expect(result.current.details?.id).toBe('second');
    expect(result.current.error).toBe(null);
    expect(result.current.loading).toBe(false);
  });

  it('does not reuse the previous chat on the first render of a new selection', async () => {
    const first = deferredChat();
    const second = deferredChat();
    vi.mocked(getChat).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const renders: ReturnType<typeof useChatDetails>[] = [];
    const { rerender } = renderHook(
      ({ id }) => {
        const state = useChatDetails(id);
        renders.push(state);
        return state;
      },
      { initialProps: { id: 'first' } },
    );
    await act(async () => first.resolve(chat('first')));
    renders.length = 0;
    rerender({ id: 'second' });
    expect(renders.every((state) => state.loading && !state.details && !state.error)).toBe(true);
    await act(async () => second.resolve(chat('second')));
  });
});
