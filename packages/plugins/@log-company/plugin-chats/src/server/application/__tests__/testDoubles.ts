/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { ChatListItemDto, ChatMemberDto, ChatMessageDto, ChatRecord } from '../dto/ChatDto';
import type { ChatAttachmentRepository } from '../ports/ChatAttachmentRepository';
import type { ChatMemberRepository } from '../ports/ChatMemberRepository';
import type { ChatMessageRepository } from '../ports/ChatMessageRepository';
import type { ChatRepository } from '../ports/ChatRepository';
import type { Clock } from '../ports/Clock';
import type { IdGenerator } from '../ports/IdGenerator';
import type { TransactionManager } from '../ports/TransactionManager';
import type { UserDirectory } from '../ports/UserDirectory';

export const fixedDate = new Date('2026-07-17T03:00:00.000Z');

export function chatRecord(overrides: Partial<ChatRecord> = {}): ChatRecord {
  return {
    id: '100',
    type: 'direct',
    title: null,
    directKey: '1:2',
    createdById: '1',
    createdAt: fixedDate,
    updatedAt: fixedDate,
    lastMessageAt: null,
    deletedAt: null,
    ...overrides,
  };
}

export function chatListItem(chat: ChatRecord = chatRecord()): ChatListItemDto {
  return {
    id: chat.id,
    type: chat.type,
    title: chat.type === 'group' ? chat.title || '' : 'Second user',
    unavailable: false,
    lastMessage: null,
    unreadCount: 0,
    updatedAt: chat.updatedAt,
  };
}

export function activeMember(overrides: Partial<ChatMemberDto> = {}): ChatMemberDto {
  return {
    id: '10',
    userId: '1',
    memberName: 'First user',
    role: 'member',
    joinedAt: fixedDate,
    leftAt: null,
    lastReadAt: fixedDate,
    isMuted: false,
    deleted: false,
    ...overrides,
  };
}

export function chatMessage(overrides: Partial<ChatMessageDto> = {}): ChatMessageDto {
  return {
    id: '500',
    chatId: '100',
    authorId: '1',
    authorName: 'First user',
    text: 'Message',
    messageType: 'text',
    systemEvent: null,
    replyToMessageId: null,
    createdAt: fixedDate,
    deletedAt: null,
    deletedById: null,
    attachments: [],
    canDelete: true,
    ...overrides,
  };
}

export function transactionManager(): TransactionManager {
  return {
    execute: async (work, existing) => work(existing || {}),
  };
}

export function fixedClock(): Clock {
  return { now: () => fixedDate };
}

export function sequentialIds(): IdGenerator {
  let value = 1000;
  return { generate: () => String(value++) };
}

export function userDirectory(): UserDirectory {
  const users = [
    { id: '1', name: 'First user' },
    { id: '2', name: 'Second user' },
    { id: '3', name: 'Third user' },
  ];
  return {
    findById: async (userId) => users.find((user) => user.id === userId) || null,
    findByIds: async (userIds) => users.filter((user) => userIds.includes(user.id)),
    search: async (_query, excludedUserId, limit) => users.filter((user) => user.id !== excludedUserId).slice(0, limit),
  };
}

function unexpected(): never {
  throw new Error('Unexpected test-double call');
}

export function chatRepository(overrides: Partial<ChatRepository> = {}): ChatRepository {
  return {
    findById: async () => null,
    findByDirectKey: async () => null,
    create: async () => unexpected(),
    createDirectIfAbsent: async () => unexpected(),
    listForUser: async () => [],
    getListItem: async () => null,
    updateGroupTitle: async () => unexpected(),
    updateLastMessageAt: async () => unexpected(),
    anonymizeCreator: async () => unexpected(),
    ...overrides,
  };
}

export function memberRepository(overrides: Partial<ChatMemberRepository> = {}): ChatMemberRepository {
  return {
    create: async () => unexpected(),
    createIfAbsent: async () => unexpected(),
    findMembership: async () => null,
    findActive: async () => null,
    listByChat: async () => [],
    markLeft: async () => unexpected(),
    markRead: async () => unexpected(),
    countUnreadChats: async () => 0,
    isDirectChatAvailable: async () => true,
    deactivateUser: async () => unexpected(),
    ...overrides,
  };
}

export function messageRepository(overrides: Partial<ChatMessageRepository> = {}): ChatMessageRepository {
  return {
    create: async () => unexpected(),
    findById: async () => null,
    list: async () => [],
    softDelete: async () => unexpected(),
    anonymizeUser: async () => unexpected(),
    ...overrides,
  };
}

export function attachmentRepository(overrides: Partial<ChatAttachmentRepository> = {}): ChatAttachmentRepository {
  return {
    create: async () => unexpected(),
    findById: async () => null,
    listByMessageIds: async () => new Map(),
    ...overrides,
  };
}
