/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DeleteOutlined, DownloadOutlined, FileOutlined } from '@ant-design/icons';
import { useAPIClient } from '@nocobase/client';
import { App, Button, Flex, Popconfirm, Space, Typography, theme } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import { useChatTranslation } from '../../../locale';
import { downloadChatAttachment } from '../api/attachmentsApi';
import { errorMessage } from '../api/apiResponse';
import { formatFileSize } from '../lib/formatFileSize';
import { formatSystemMessage } from '../lib/formatSystemMessage';
import type { ChatMessage } from '../model/types';

interface MessageItemProps {
  message: ChatMessage;
  isOwn: boolean;
  onDelete: (messageId: string) => Promise<void>;
}

export function MessageItem({ message, isOwn, onDelete }: MessageItemProps) {
  const { t } = useChatTranslation();
  const api = useAPIClient();
  const { message: notification } = App.useApp();
  const { token } = theme.useToken();

  const download = async (attachmentId: string, fileName: string): Promise<void> => {
    try {
      await downloadChatAttachment(api, attachmentId, fileName);
    } catch (requestError) {
      notification.error(errorMessage(requestError, t('errors.STORAGE_DOWNLOAD_FAILED')));
    }
  };
  if (message.messageType === 'system' && !message.deletedAt) {
    return (
      <Typography.Text type="secondary" style={{ alignSelf: 'center', fontSize: token.fontSizeSM }}>
        {formatSystemMessage(message.systemEvent, t)}
      </Typography.Text>
    );
  }
  return (
    <Flex justify={isOwn ? 'flex-end' : 'flex-start'}>
      <div
        style={{
          maxWidth: 'min(680px, 86%)',
          padding: `${token.paddingXS}px ${token.paddingSM}px`,
          borderRadius: token.borderRadiusLG,
          background: isOwn ? token.colorPrimaryBg : token.colorFillAlter,
        }}
      >
        {!isOwn ? (
          <Typography.Text strong style={{ display: 'block', fontSize: token.fontSizeSM }}>
            {message.authorName}
          </Typography.Text>
        ) : null}
        {message.deletedAt ? (
          <Typography.Text italic type="secondary">
            {t('messages.deleted')}
          </Typography.Text>
        ) : (
          <>
            {message.text ? (
              <Typography.Paragraph style={{ marginBottom: 4 }}>{message.text}</Typography.Paragraph>
            ) : null}
            {message.attachments.length ? (
              <Space direction="vertical" size={2} style={{ display: 'flex' }}>
                {message.attachments.map((attachment) => (
                  <Button
                    key={attachment.id}
                    type="text"
                    icon={<FileOutlined />}
                    onClick={() => download(attachment.id, attachment.fileName)}
                    aria-label={t('attachments.download', { fileName: attachment.fileName })}
                    style={{ paddingInline: 0, height: 'auto' }}
                  >
                    {attachment.fileName} · {formatFileSize(attachment.size)} <DownloadOutlined />
                  </Button>
                ))}
              </Space>
            ) : null}
          </>
        )}
        <Flex justify="flex-end" align="center" gap={token.marginXXS}>
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {dayjs(message.createdAt).format('HH:mm')}
          </Typography.Text>
          {message.canDelete ? (
            <Popconfirm
              title={t('messages.deleteConfirm')}
              okText={t('common.delete')}
              cancelText={t('common.cancel')}
              onConfirm={() => onDelete(message.id)}
            >
              <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label={t('messages.delete')} />
            </Popconfirm>
          ) : null}
        </Flex>
      </div>
    </Flex>
  );
}
