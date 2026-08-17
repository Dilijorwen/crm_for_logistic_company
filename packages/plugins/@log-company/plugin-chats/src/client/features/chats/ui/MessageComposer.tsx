/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { PaperClipOutlined, SendOutlined } from '@ant-design/icons';
import { App, Button, Flex, Input, Tag, Tooltip, theme } from 'antd';
import React, { useRef, useState } from 'react';
import { ALLOWED_ATTACHMENT_EXTENSIONS, CHAT_LIMITS } from '../../../../shared/chatLimits';
import { useChatTranslation } from '../../../locale';
import { errorMessage } from '../api/apiResponse';

interface MessageComposerProps {
  disabled: boolean;
  onSend: (text: string, files: File[]) => Promise<void>;
}

export function MessageComposer({ disabled, onSend }: MessageComposerProps) {
  const { t } = useChatTranslation();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  const chooseFiles = (selected: FileList | null) => {
    const next = [...files, ...Array.from(selected || [])];
    if (next.length > CHAT_LIMITS.maximumAttachmentsPerMessage) {
      message.error(t('attachments.tooMany', { count: CHAT_LIMITS.maximumAttachmentsPerMessage }));
      return;
    }
    if (next.some((file) => file.size > CHAT_LIMITS.maximumAttachmentSizeBytes)) {
      message.error(t('attachments.tooLarge'));
      return;
    }
    setFiles(next);
    if (inputRef.current) inputRef.current.value = '';
  };

  const submit = async () => {
    if (sending || disabled || (!text.trim() && !files.length)) return;
    setSending(true);
    try {
      await onSend(text, files);
      setText('');
      setFiles([]);
    } catch (requestError) {
      message.error(errorMessage(requestError, t('errors.sendFailed')));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        padding: token.paddingSM,
        flexShrink: 0,
      }}
    >
      {files.length ? (
        <Flex wrap gap={token.marginXXS} style={{ marginBottom: token.marginXS }}>
          {files.map((file, index) => (
            <Tag
              key={`${file.name}-${file.lastModified}-${index}`}
              closable
              onClose={() => setFiles((all) => all.filter((_, itemIndex) => itemIndex !== index))}
            >
              {file.name}
            </Tag>
          ))}
        </Flex>
      ) : null}
      <Flex gap={token.marginXS} align="flex-end">
        <input
          ref={inputRef}
          type="file"
          hidden
          multiple
          accept={ALLOWED_ATTACHMENT_EXTENSIONS.map((extension) => `.${extension}`).join(',')}
          onChange={(event) => chooseFiles(event.target.files)}
        />
        <Tooltip title={t('attachments.add')}>
          <Button
            icon={<PaperClipOutlined />}
            disabled={disabled || sending}
            onClick={() => inputRef.current?.click()}
            aria-label={t('attachments.add')}
          />
        </Tooltip>
        <Input.TextArea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={disabled ? t('chat.unavailable') : t('messages.placeholder')}
          aria-label={t('messages.placeholder')}
          disabled={disabled}
          autoSize={{ minRows: 1, maxRows: 5 }}
          maxLength={CHAT_LIMITS.maximumMessageLength}
          onPressEnter={(event) => {
            if (!event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={sending}
          disabled={disabled || (!text.trim() && !files.length)}
          onClick={submit}
          aria-label={t('messages.send')}
        >
          {t('messages.send')}
        </Button>
      </Flex>
    </div>
  );
}
