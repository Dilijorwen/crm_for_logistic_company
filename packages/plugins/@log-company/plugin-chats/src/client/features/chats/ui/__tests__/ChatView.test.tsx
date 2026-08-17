/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { render, screen } from '@testing-library/react';
import { App } from 'antd';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChatView } from '../ChatView';

vi.mock('@nocobase/client', () => ({
  useAPIClient: () => ({}),
  useCurrentUserContext: () => ({ data: { data: { id: 'current-user' } } }),
}));

vi.mock('../../../../locale', () => ({
  useChatTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../hooks/useChatDetails', () => ({
  useChatDetails: () => ({
    details: {
      id: 'chat-1',
      title: 'Layout test chat',
      type: 'direct',
      unavailable: false,
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock('../../hooks/useChatMessages', () => ({
  useChatMessages: () => ({
    messages: [],
    loading: false,
    loadingOlder: false,
    hasOlder: false,
    error: null,
    loadOlder: vi.fn(),
    send: vi.fn(),
    remove: vi.fn(),
  }),
}));

vi.mock('../ChatHeader', () => ({
  ChatHeader: () => <div>Chat header</div>,
}));

vi.mock('../MessageList', () => ({
  MessageList: () => <div>Message list</div>,
}));

vi.mock('../MessageComposer', () => ({
  MessageComposer: () => <div>Message composer</div>,
}));

vi.mock('../ManageMembersModal', () => ({
  ManageMembersModal: () => null,
}));

describe('ChatView layout', () => {
  it('fills the available flex column without overflowing it', () => {
    render(
      <App>
        <ChatView chatId="chat-1" showBack={false} onBack={vi.fn()} onLeft={vi.fn()} />
      </App>,
    );

    const chatView = screen.getByTestId('chat-view');
    expect(chatView.style.flex).toBe('1');
    expect(chatView.style.width).toBe('100%');
    expect(chatView.style.minWidth).toBe('0');
    expect(chatView.style.minHeight).toBe('0');
    expect(chatView.style.overflow).toBe('hidden');
  });
});
