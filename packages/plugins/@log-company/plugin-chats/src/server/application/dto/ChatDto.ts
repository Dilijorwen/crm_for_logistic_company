/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { ChatMemberRole, ChatMessageType, ChatType, SystemMessageEvent } from '../../domain/chat/ChatTypes';

export interface ChatRecord {
  id: string;
  type: ChatType;
  title: string | null;
  directKey: string | null;
  createdById: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastMessageAt: Date | string | null;
  deletedAt: Date | string | null;
}

export interface ChatMemberDto {
  id: string;
  userId: string | null;
  memberName: string;
  role: ChatMemberRole;
  joinedAt: Date | string;
  leftAt: Date | string | null;
  lastReadAt: Date | string | null;
  isMuted: boolean;
  deleted: boolean;
}

export interface ChatAttachmentDto {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface ChatMessageDto {
  id: string;
  chatId: string;
  authorId: string | null;
  authorName: string;
  text: string | null;
  messageType: ChatMessageType;
  systemEvent: SystemMessageEvent | null;
  replyToMessageId: string | null;
  createdAt: Date | string;
  deletedAt: Date | string | null;
  deletedById: string | null;
  attachments: ChatAttachmentDto[];
  canDelete: boolean;
}

export interface LastChatMessageDto {
  text: string | null;
  authorName: string;
  createdAt: Date | string;
  deleted: boolean;
  messageType: ChatMessageType;
  systemEvent: SystemMessageEvent | null;
}

export interface ChatListItemDto {
  id: string;
  type: ChatType;
  title: string;
  unavailable: boolean;
  lastMessage: LastChatMessageDto | null;
  unreadCount: number;
  updatedAt: Date | string;
}

export interface ChatDetailsDto extends ChatListItemDto {
  members: ChatMemberDto[];
  currentRole: ChatMemberRole;
  canManageMembers: boolean;
}

export interface MessagePageDto {
  items: ChatMessageDto[];
  nextCursor: string | null;
}

export interface ChatUserDto {
  id: string;
  name: string;
}
