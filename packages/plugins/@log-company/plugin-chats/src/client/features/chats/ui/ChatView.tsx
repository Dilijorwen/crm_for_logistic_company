/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useAPIClient, useCurrentUserContext } from '@nocobase/client';
import { App, Empty, Input, Modal, Result, Spin, theme } from 'antd';
import React, { useState } from 'react';
import { CHAT_LIMITS } from '../../../../shared/chatLimits';
import { useChatTranslation } from '../../../locale';
import { updateGroupChat } from '../api/chatsApi';
import { errorMessage } from '../api/apiResponse';
import { useChatDetails } from '../hooks/useChatDetails';
import { useChatMessages } from '../hooks/useChatMessages';
import { dispatchChatRefresh } from '../lib/chatEvents';
import { ChatHeader } from './ChatHeader';
import { ManageMembersModal } from './ManageMembersModal';
import { MessageComposer } from './MessageComposer';
import { MessageList } from './MessageList';

interface ChatViewProps {
  chatId: string | null;
  showBack: boolean;
  onBack: () => void;
  onLeft: () => void;
}

export function ChatView({ chatId, showBack, onBack, onLeft }: ChatViewProps) {
  const { t } = useChatTranslation();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const api = useAPIClient();
  const currentUser = useCurrentUserContext();
  const currentUserId = String(currentUser?.data?.data?.id || '');
  const { details, loading: detailsLoading, error: detailsError, refresh: refreshDetails } = useChatDetails(chatId);
  const { messages, loading, loadingOlder, hasOlder, error, loadOlder, send, remove } = useChatMessages(chatId);
  const [manageOpen, setManageOpen] = useState(false);
  const [editTitleOpen, setEditTitleOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);

  if (!chatId) {
    return <Empty description={t('chat.select')} style={{ margin: 'auto' }} />;
  }
  if (detailsLoading && !details) {
    return <Spin aria-label={t('common.loading')} style={{ margin: 'auto' }} />;
  }
  if (detailsError || !details) {
    return <Result status="error" title={t('errors.loadChat')} />;
  }

  const saveTitle = async () => {
    if (!title.trim()) return;
    setSavingTitle(true);
    try {
      await updateGroupChat(api, details.id, title);
      await refreshDetails();
      dispatchChatRefresh();
      setEditTitleOpen(false);
    } catch (requestError) {
      message.error(errorMessage(requestError, t('errors.updateFailed')));
    } finally {
      setSavingTitle(false);
    }
  };

  return (
    <div
      data-testid="chat-view"
      style={{
        display: 'flex',
        flex: 1,
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <ChatHeader
        chat={details}
        showBack={showBack}
        onBack={onBack}
        onManageMembers={() => setManageOpen(true)}
        onEditTitle={() => {
          setTitle(details.title);
          setEditTitleOpen(true);
        }}
      />
      {error ? <Result status="error" title={t('errors.loadMessages')} /> : null}
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        loading={loading}
        loadingOlder={loadingOlder}
        hasOlder={hasOlder}
        onLoadOlder={loadOlder}
        onDelete={remove}
      />
      <MessageComposer disabled={details.unavailable} onSend={send} />
      <ManageMembersModal
        open={manageOpen}
        chat={details}
        currentUserId={currentUserId}
        onClose={() => setManageOpen(false)}
        onChanged={async () => {
          await refreshDetails();
          dispatchChatRefresh();
        }}
        onLeft={onLeft}
      />
      <Modal
        open={editTitleOpen}
        title={t('chat.editTitle')}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={savingTitle}
        onOk={saveTitle}
        onCancel={() => setEditTitleOpen(false)}
      >
        <Input
          value={title}
          maxLength={CHAT_LIMITS.maximumGroupTitleLength}
          onChange={(event) => setTitle(event.target.value)}
          aria-label={t('chat.title')}
          style={{ marginTop: token.marginXS }}
        />
      </Modal>
    </div>
  );
}
