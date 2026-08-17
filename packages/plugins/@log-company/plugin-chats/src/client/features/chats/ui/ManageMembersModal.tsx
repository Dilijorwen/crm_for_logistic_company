/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DeleteOutlined, LogoutOutlined, UserAddOutlined } from '@ant-design/icons';
import { App, Button, Flex, List, Modal, Popconfirm, Select, Space, Tag, Typography } from 'antd';
import { useAPIClient } from '@nocobase/client';
import React, { useState } from 'react';
import { CHAT_LIMITS } from '../../../../shared/chatLimits';
import { useChatTranslation } from '../../../locale';
import { addChatMembers, leaveChat, removeChatMember } from '../api/chatsApi';
import { errorMessage } from '../api/apiResponse';
import { useChatUsers } from '../hooks/useChatUsers';
import type { ChatDetails } from '../model/types';

interface ManageMembersModalProps {
  open: boolean;
  chat: ChatDetails;
  currentUserId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onLeft: () => void;
}

export function ManageMembersModal({ open, chat, currentUserId, onClose, onChanged, onLeft }: ManageMembersModalProps) {
  const { t } = useChatTranslation();
  const { message } = App.useApp();
  const api = useAPIClient();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { users, loading, error: usersError } = useChatUsers(query);
  const activeIds = new Set(chat.members.flatMap((member) => (!member.leftAt && member.userId ? [member.userId] : [])));
  const availableParticipantSlots = Math.max(0, CHAT_LIMITS.maximumGroupParticipants - activeIds.size);

  const add = async () => {
    if (!selected.length) return;
    if (selected.length > availableParticipantSlots) {
      message.error(t('validation.tooManyParticipants', { count: availableParticipantSlots }));
      return;
    }
    setSubmitting(true);
    try {
      await addChatMembers(api, chat.id, selected);
      setSelected([]);
      await onChanged();
    } catch (requestError) {
      message.error(errorMessage(requestError, t('errors.membersFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (userId: string) => {
    try {
      await removeChatMember(api, chat.id, userId);
      await onChanged();
    } catch (requestError) {
      message.error(errorMessage(requestError, t('errors.membersFailed')));
    }
  };

  const leave = async () => {
    try {
      await leaveChat(api, chat.id);
      onClose();
      onLeft();
    } catch (requestError) {
      message.error(errorMessage(requestError, t('errors.leaveFailed')));
    }
  };

  return (
    <Modal open={open} title={t('members.manage')} footer={null} onCancel={onClose} destroyOnClose>
      <Space direction="vertical" style={{ display: 'flex' }}>
        {chat.canManageMembers ? (
          <Flex gap={8}>
            <Select
              mode="multiple"
              value={selected}
              onChange={setSelected}
              onSearch={setQuery}
              showSearch
              filterOption={false}
              loading={loading}
              disabled={availableParticipantSlots === 0}
              notFoundContent={usersError ? t('errors.loadUsers') : undefined}
              placeholder={t('members.add')}
              aria-label={t('members.add')}
              style={{ flex: 1 }}
              options={users
                .filter((user) => !activeIds.has(user.id))
                .map((user) => ({ value: user.id, label: user.name }))}
            />
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              disabled={!selected.length || availableParticipantSlots === 0}
              loading={submitting}
              onClick={add}
            >
              {t('members.add')}
            </Button>
          </Flex>
        ) : null}
        <List
          dataSource={chat.members.filter((member) => !member.leftAt || member.deleted)}
          renderItem={(member) => (
            <List.Item
              actions={
                chat.canManageMembers &&
                member.userId &&
                member.userId !== currentUserId &&
                member.role !== 'owner' &&
                !member.leftAt
                  ? [
                      <Popconfirm
                        key="remove"
                        title={t('members.removeConfirm', { name: member.memberName })}
                        onConfirm={() => remove(member.userId || '')}
                        okText={t('common.delete')}
                        cancelText={t('common.cancel')}
                      >
                        <Button danger type="text" icon={<DeleteOutlined />} aria-label={t('members.remove')} />
                      </Popconfirm>,
                    ]
                  : []
              }
            >
              <List.Item.Meta
                title={
                  <Flex gap={8} align="center">
                    <Typography.Text>{member.memberName}</Typography.Text>
                    <Tag>{t(`roles.${member.role}`)}</Tag>
                    {member.deleted ? <Tag>{t('users.deleted')}</Tag> : null}
                  </Flex>
                }
              />
            </List.Item>
          )}
        />
        {chat.currentRole !== 'owner' ? (
          <Popconfirm
            title={t('chat.leaveConfirm')}
            onConfirm={leave}
            okText={t('chat.leave')}
            cancelText={t('common.cancel')}
          >
            <Button danger icon={<LogoutOutlined />}>
              {t('chat.leave')}
            </Button>
          </Popconfirm>
        ) : null}
      </Space>
    </Modal>
  );
}
