/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, TeamOutlined } from '@ant-design/icons';
import { Button, Flex, Popconfirm, Tag, Typography, theme } from 'antd';
import React from 'react';
import { useChatTranslation } from '../../../locale';
import type { ChatDetails } from '../model/types';

interface ChatHeaderProps {
  chat: ChatDetails;
  showBack: boolean;
  onBack: () => void;
  onManageMembers: () => void;
  onEditTitle: () => void;
  onDelete: () => Promise<void>;
  deleting: boolean;
}

export function ChatHeader({
  chat,
  showBack,
  onBack,
  onManageMembers,
  onEditTitle,
  onDelete,
  deleting,
}: ChatHeaderProps) {
  const { t } = useChatTranslation();
  const { token } = theme.useToken();
  return (
    <Flex
      justify="space-between"
      align="center"
      gap={token.marginSM}
      style={{
        padding: token.paddingSM,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        flexShrink: 0,
      }}
    >
      <Flex gap={token.marginXS} align="center" style={{ minWidth: 0 }}>
        {showBack ? (
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} aria-label={t('common.back')} />
        ) : null}
        <Typography.Title level={5} ellipsis style={{ margin: 0 }}>
          {chat.title}
        </Typography.Title>
        {chat.unavailable ? <Tag>{t('users.deleted')}</Tag> : null}
      </Flex>
      <Flex gap={token.marginXXS}>
        {chat.type === 'group' ? (
          <Flex gap={token.marginXXS}>
            {chat.canManageMembers ? (
              <Button type="text" icon={<EditOutlined />} onClick={onEditTitle} aria-label={t('chat.editTitle')} />
            ) : null}
            <Button type="text" icon={<TeamOutlined />} onClick={onManageMembers} aria-label={t('members.manage')} />
          </Flex>
        ) : null}
        {chat.canDeleteChat ? (
          <Popconfirm
            title="Удалить чат для всех участников?"
            description="Сообщения и вложения чата станут недоступны."
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={onDelete}
            okButtonProps={{ danger: true, loading: deleting }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} loading={deleting} aria-label="Удалить чат" />
          </Popconfirm>
        ) : null}
      </Flex>
    </Flex>
  );
}
