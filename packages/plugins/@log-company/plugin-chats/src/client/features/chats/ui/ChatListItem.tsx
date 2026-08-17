/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Avatar, Badge, Flex, Tag, Typography, theme } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import { useChatTranslation } from '../../../locale';
import { formatSystemMessage } from '../lib/formatSystemMessage';
import type { ChatListItem as ChatListItemType } from '../model/types';

interface ChatListItemProps {
  item: ChatListItemType;
  selected: boolean;
  onSelect: (chatId: string) => void;
}

function initials(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function ChatListItem({ item, selected, onSelect }: ChatListItemProps) {
  const { t } = useChatTranslation();
  const { token } = theme.useToken();
  const lastMessage = item.lastMessage;
  const preview = lastMessage?.deleted
    ? t('messages.deleted')
    : lastMessage?.messageType === 'system'
      ? formatSystemMessage(lastMessage.systemEvent, t)
      : lastMessage?.text || (lastMessage?.messageType === 'file' ? t('messages.attachment') : t('messages.none'));

  return (
    <button
      type="button"
      aria-current={selected ? 'page' : undefined}
      aria-label={t('chat.open', { title: item.title })}
      onClick={() => onSelect(item.id)}
      style={{
        width: '100%',
        border: 0,
        borderRadius: token.borderRadiusLG,
        padding: token.paddingSM,
        background: selected ? token.colorPrimaryBg : 'transparent',
        color: token.colorText,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <Flex gap={token.marginSM} align="center">
        <Badge count={item.unreadCount} overflowCount={99} size="small">
          <Avatar style={{ background: item.type === 'group' ? token.colorPrimary : token.colorInfo }}>
            {initials(item.title) || '?'}
          </Avatar>
        </Badge>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Flex justify="space-between" gap={token.marginXS} align="center">
            <Typography.Text strong ellipsis style={{ minWidth: 0 }}>
              {item.title}
            </Typography.Text>
            {lastMessage ? (
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, whiteSpace: 'nowrap' }}>
                {dayjs(lastMessage.createdAt).format('HH:mm')}
              </Typography.Text>
            ) : null}
          </Flex>
          <Flex gap={token.marginXS} align="center">
            <Typography.Text type="secondary" ellipsis style={{ flex: 1, minWidth: 0, fontSize: token.fontSizeSM }}>
              {item.type === 'group' && lastMessage?.authorName ? `${lastMessage.authorName}: ` : ''}
              {preview}
            </Typography.Text>
            {item.unavailable ? <Tag color="default">{t('users.deleted')}</Tag> : null}
          </Flex>
        </div>
      </Flex>
    </button>
  );
}
