/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { APIClient } from '@nocobase/client';
import type { ChatMessage, MessagePage } from '../model/types';
import { unwrapResponse } from './apiResponse';

export async function listChatMessages(api: APIClient, chatId: string, cursor: string | null): Promise<MessagePage> {
  return unwrapResponse<MessagePage>(
    await api.request({
      url: 'chatMessages:list',
      method: 'get',
      params: { chatId, cursor: cursor || undefined },
    }),
  );
}

export async function sendChatMessage(api: APIClient, chatId: string, text: string): Promise<ChatMessage> {
  return unwrapResponse<ChatMessage>(
    await api.request({ url: 'chatMessages:send', method: 'post', data: { chatId, text } }),
  );
}

export async function deleteChatMessage(api: APIClient, messageId: string): Promise<void> {
  await api.request({ url: 'chatMessages:delete', method: 'post', data: { messageId } });
}

export async function markChatAsRead(api: APIClient, chatId: string): Promise<void> {
  await api.request({ url: 'chatMessages:markRead', method: 'post', data: { chatId } });
}
