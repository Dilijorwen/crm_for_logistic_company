/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { App, Button, Empty, Flex, Spin, theme } from 'antd';
import React, { useEffect, useRef } from 'react';
import { useChatTranslation } from '../../../locale';
import type { ChatMessage } from '../model/types';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  loading: boolean;
  loadingOlder: boolean;
  hasOlder: boolean;
  onLoadOlder: () => Promise<boolean>;
  onDelete: (messageId: string) => Promise<void>;
}

export function MessageList({
  messages,
  currentUserId,
  loading,
  loadingOlder,
  hasOlder,
  onLoadOlder,
  onDelete,
}: MessageListProps) {
  const { t } = useChatTranslation();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const containerRef = useRef<HTMLDivElement>(null);
  const previousCount = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (container && previousCount.current === 0 && messages.length) {
      container.scrollTop = container.scrollHeight;
    }
    previousCount.current = messages.length;
  }, [messages]);

  const loadOlder = async (): Promise<void> => {
    try {
      const container = containerRef.current;
      const previousHeight = container?.scrollHeight || 0;
      const loaded = await onLoadOlder();
      if (loaded && container) {
        window.requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight - previousHeight;
        });
      }
    } catch {
      message.error(t('errors.loadMessages'));
    }
  };

  if (loading) {
    return <Spin aria-label={t('common.loading')} style={{ margin: 'auto' }} />;
  }

  return (
    <div
      ref={containerRef}
      role="log"
      aria-live="polite"
      aria-label={t('messages.list')}
      style={{ overflowY: 'auto', flex: 1, width: '100%', minWidth: 0, minHeight: 0, padding: token.paddingMD }}
    >
      <Flex vertical gap={token.marginSM}>
        {hasOlder ? (
          <Button type="text" loading={loadingOlder} onClick={loadOlder}>
            {t('messages.loadOlder')}
          </Button>
        ) : null}
        {!messages.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('messages.empty')} /> : null}
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            isOwn={message.authorId === currentUserId}
            onDelete={onDelete}
          />
        ))}
      </Flex>
    </div>
  );
}
