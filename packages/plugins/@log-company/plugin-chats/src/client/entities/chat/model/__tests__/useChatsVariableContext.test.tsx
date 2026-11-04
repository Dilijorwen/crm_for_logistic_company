/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useChatsVariableContext } from '../useChatsVariableContext';

const unreadChatsState = vi.hoisted(() => ({ unreadCount: 3 }));

vi.mock('../useUnreadChatsCount', () => ({
  useUnreadChatsCount: () => ({
    unreadCount: unreadChatsState.unreadCount,
    refresh: vi.fn(),
  }),
}));

describe('useChatsVariableContext', () => {
  it('keeps the context reference stable until the unread count changes', () => {
    const { result, rerender } = renderHook(() => useChatsVariableContext());
    const initialContext = result.current;

    rerender();
    expect(result.current).toBe(initialContext);

    unreadChatsState.unreadCount = 4;
    rerender();
    expect(result.current).not.toBe(initialContext);
    expect(result.current).toEqual({ unreadCount: 4 });
  });
});
