/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { App, Form, Input, Modal, Radio, Select, Space } from 'antd';
import { useAPIClient } from '@nocobase/client';
import React, { useEffect, useState } from 'react';
import { CHAT_LIMITS } from '../../../../shared/chatLimits';
import { useChatTranslation } from '../../../locale';
import { createDirectChat, createGroupChat } from '../api/chatsApi';
import { errorMessage } from '../api/apiResponse';
import { useChatUsers } from '../hooks/useChatUsers';
import type { ChatListItem, ChatType } from '../model/types';

interface CreateChatModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (chat: ChatListItem) => void;
}

export function CreateChatModal({ open, onClose, onCreated }: CreateChatModalProps) {
  const { t } = useChatTranslation();
  const { message } = App.useApp();
  const api = useAPIClient();
  const [form] = Form.useForm();
  const [type, setType] = useState<ChatType>('direct');
  const [query, setQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { users, loading, error: usersError } = useChatUsers(query);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setType('direct');
      setQuery('');
    }
  }, [form, open]);

  const submit = async () => {
    const values = (await form.validateFields()) as { title?: string; userIds: string | string[] };
    const selectedUserIds = Array.isArray(values.userIds) ? values.userIds : [values.userIds];
    setSubmitting(true);
    try {
      const chat =
        type === 'direct'
          ? await createDirectChat(api, selectedUserIds[0])
          : await createGroupChat(api, values.title || '', selectedUserIds);
      onCreated(chat);
      onClose();
    } catch (requestError) {
      message.error(errorMessage(requestError, t('errors.createFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('chat.new')}
      okText={t('common.create')}
      cancelText={t('common.cancel')}
      confirmLoading={submitting}
      onOk={submit}
      onCancel={onClose}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Space direction="vertical" style={{ display: 'flex' }}>
          <Radio.Group
            value={type}
            onChange={(event) => {
              setType(event.target.value as ChatType);
              form.setFieldValue('userIds', []);
            }}
          >
            <Radio.Button value="direct">{t('chat.direct')}</Radio.Button>
            <Radio.Button value="group">{t('chat.group')}</Radio.Button>
          </Radio.Group>
          {type === 'group' ? (
            <Form.Item
              name="title"
              label={t('chat.title')}
              rules={[{ required: true, whitespace: true, message: t('validation.required') }]}
            >
              <Input maxLength={CHAT_LIMITS.maximumGroupTitleLength} />
            </Form.Item>
          ) : null}
          <Form.Item
            name="userIds"
            label={type === 'direct' ? t('chat.participant') : t('members.participants')}
            rules={[
              {
                required: true,
                validator: async (_, value: unknown) => {
                  const selectedUserIds = Array.isArray(value) ? value : value ? [value] : [];
                  if (type === 'direct' ? selectedUserIds.length !== 1 : selectedUserIds.length < 1) {
                    throw new Error(t('validation.selectParticipants'));
                  }
                  if (type === 'group' && selectedUserIds.length + 1 > CHAT_LIMITS.maximumGroupParticipants) {
                    throw new Error(
                      t('validation.tooManyParticipants', {
                        count: CHAT_LIMITS.maximumGroupParticipants - 1,
                      }),
                    );
                  }
                },
              },
            ]}
          >
            <Select
              mode={type === 'group' ? 'multiple' : undefined}
              showSearch
              filterOption={false}
              onSearch={setQuery}
              loading={loading}
              notFoundContent={usersError ? t('errors.loadUsers') : undefined}
              options={users.map((user) => ({ value: user.id, label: user.name }))}
              placeholder={t('members.search')}
              aria-label={type === 'direct' ? t('chat.participant') : t('members.participants')}
            />
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  );
}
