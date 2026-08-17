/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { App, Button, Flex, Grid, Result, Spin, Typography, theme } from 'antd';
import React, { useState } from 'react';
import { useChatTranslation } from '../../../locale';
import { useChatList } from '../hooks/useChatList';
import { dispatchChatRefresh } from '../lib/chatEvents';
import type { ChatListItem } from '../model/types';
import { ChatList } from './ChatList';
import { ChatView } from './ChatView';
import { CreateChatModal } from './CreateChatModal';

export function ChatsPage() {
  const { t } = useChatTranslation();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isNarrow = !screens.md;
  const { items, loading, error, refresh } = useChatList();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const created = (chat: ChatListItem) => {
    setSelectedChatId(chat.id);
    dispatchChatRefresh();
  };

  const refreshList = async () => {
    const refreshed = await refresh();
    if (!refreshed) {
      message.error(t('errors.loadChats'));
    }
  };

  const listPanel = (
    <div
      style={{
        width: isNarrow ? '100%' : 340,
        minWidth: isNarrow ? 0 : 300,
        height: '100%',
        minHeight: 0,
        padding: token.paddingMD,
        borderRight: isNarrow ? 0 : `1px solid ${token.colorBorderSecondary}`,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <Flex justify="space-between" align="center" style={{ marginBottom: token.marginSM }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t('chat.chats')}
        </Typography.Title>
        <Flex gap={token.marginXXS}>
          <Button type="text" icon={<ReloadOutlined />} onClick={refreshList} aria-label={t('common.refresh')} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} aria-label={t('chat.new')}>
            {isNarrow ? null : t('chat.new')}
          </Button>
        </Flex>
      </Flex>
      {loading && !items.length ? <Spin aria-label={t('common.loading')} /> : null}
      {error && !items.length ? <Result status="error" title={t('errors.loadChats')} /> : null}
      {!loading || items.length ? (
        <ChatList items={items} selectedChatId={selectedChatId} onSelect={setSelectedChatId} />
      ) : null}
    </div>
  );

  return (
    <App>
      <div
        style={{
          height: 'calc(100vh - var(--nb-header-height))',
          minHeight: 520,
          background: token.colorBgContainer,
          overflow: 'hidden',
        }}
      >
        <Flex style={{ height: '100%', minWidth: 0 }}>
          {!isNarrow || !selectedChatId ? listPanel : null}
          {!isNarrow || selectedChatId ? (
            <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex' }}>
              <ChatView
                chatId={selectedChatId}
                showBack={isNarrow}
                onBack={() => setSelectedChatId(null)}
                onLeft={() => {
                  setSelectedChatId(null);
                  dispatchChatRefresh();
                }}
              />
            </div>
          ) : null}
        </Flex>
        <CreateChatModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={created} />
      </div>
    </App>
  );
}
