/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { APIClient } from '@nocobase/client';
import type { ChatDetails, ChatListItem, ChatUser } from '../model/types';
import { unwrapResponse } from './apiResponse';

export async function listChats(api: APIClient): Promise<ChatListItem[]> {
  return unwrapResponse<ChatListItem[]>(await api.request({ url: 'chats:list', method: 'get' }));
}

export async function getChat(api: APIClient, chatId: string): Promise<ChatDetails> {
  return unwrapResponse<ChatDetails>(await api.request({ url: 'chats:get', method: 'get', params: { chatId } }));
}

export async function createDirectChat(api: APIClient, otherUserId: string): Promise<ChatListItem> {
  return unwrapResponse<ChatListItem>(
    await api.request({ url: 'chats:createDirect', method: 'post', data: { otherUserId } }),
  );
}

export async function createGroupChat(api: APIClient, title: string, memberUserIds: string[]): Promise<ChatListItem> {
  return unwrapResponse<ChatListItem>(
    await api.request({ url: 'chats:createGroup', method: 'post', data: { title, memberUserIds } }),
  );
}

export async function addChatMembers(api: APIClient, chatId: string, userIds: string[]): Promise<void> {
  await api.request({ url: 'chats:addMembers', method: 'post', data: { chatId, userIds } });
}

export async function removeChatMember(api: APIClient, chatId: string, userId: string): Promise<void> {
  await api.request({ url: 'chats:removeMember', method: 'post', data: { chatId, userId } });
}

export async function leaveChat(api: APIClient, chatId: string): Promise<void> {
  await api.request({ url: 'chats:leave', method: 'post', data: { chatId } });
}

export async function updateGroupChat(api: APIClient, chatId: string, title: string): Promise<void> {
  await api.request({ url: 'chats:updateGroup', method: 'post', data: { chatId, title } });
}

export async function getUnreadChatsCount(api: APIClient): Promise<number> {
  const result = unwrapResponse<{ count: number }>(await api.request({ url: 'chats:unreadCount', method: 'get' }));
  return Number(result.count || 0);
}

export async function searchChatUsers(api: APIClient, query: string): Promise<ChatUser[]> {
  return unwrapResponse<ChatUser[]>(
    await api.request({ url: 'chats:availableUsers', method: 'get', params: { query } }),
  );
}
