/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Empty, Flex, Input, Space, Typography, theme } from 'antd';
import React, { useMemo, useState } from 'react';
import { useChatTranslation } from '../../../locale';
import type { ChatListItem as ChatListItemType, ChatType } from '../model/types';
import { ChatListItem } from './ChatListItem';

interface ChatListProps {
  items: ChatListItemType[];
  selectedChatId: string | null;
  onSelect: (chatId: string) => void;
}

export function ChatList({ items, selectedChatId, onSelect }: ChatListProps) {
  const { t } = useChatTranslation();
  const { token } = theme.useToken();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized ? items.filter((item) => item.title.toLocaleLowerCase().includes(normalized)) : items;
  }, [items, query]);

  const renderSection = (type: ChatType, title: string) => {
    const sectionItems = filtered.filter((item) => item.type === type);
    if (!sectionItems.length) return null;
    return (
      <section aria-label={title}>
        <Typography.Text type="secondary" style={{ paddingInline: token.paddingSM, fontSize: token.fontSizeSM }}>
          {title}
        </Typography.Text>
        <Space direction="vertical" size={2} style={{ display: 'flex', marginTop: token.marginXXS }}>
          {sectionItems.map((item) => (
            <ChatListItem key={item.id} item={item} selected={selectedChatId === item.id} onSelect={onSelect} />
          ))}
        </Space>
      </section>
    );
  };

  return (
    <Flex
      vertical
      gap={token.marginSM}
      style={{ flex: 1, width: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' }}
    >
      <Input.Search
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        allowClear
        placeholder={t('chat.search')}
        aria-label={t('chat.search')}
      />
      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {!filtered.length ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('chat.empty')} />
        ) : (
          <Space direction="vertical" size={token.marginSM} style={{ display: 'flex' }}>
            {renderSection('direct', t('chat.directChats'))}
            {renderSection('group', t('chat.groupChats'))}
          </Space>
        )}
      </div>
    </Flex>
  );
}
