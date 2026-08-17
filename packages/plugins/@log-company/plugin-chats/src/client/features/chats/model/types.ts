/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export type ChatType = 'direct' | 'group';
export type ChatMemberRole = 'owner' | 'admin' | 'member';
export type ChatMessageType = 'text' | 'system' | 'file';
export type SystemMessageKey = 'memberAdded' | 'memberRemoved' | 'memberLeft' | 'groupTitleChanged';

export interface SystemMessageEvent {
  key: SystemMessageKey;
  actorName: string;
  subjectName?: string;
  title?: string;
}

export interface LastChatMessage {
  text: string | null;
  authorName: string;
  createdAt: string;
  deleted: boolean;
  messageType: ChatMessageType;
  systemEvent: SystemMessageEvent | null;
}

export interface ChatListItem {
  id: string;
  type: ChatType;
  title: string;
  unavailable: boolean;
  lastMessage: LastChatMessage | null;
  unreadCount: number;
  updatedAt: string;
}

export interface ChatMember {
  id: string;
  userId: string | null;
  memberName: string;
  role: ChatMemberRole;
  joinedAt: string;
  leftAt: string | null;
  lastReadAt: string | null;
  isMuted: boolean;
  deleted: boolean;
}

export interface ChatDetails extends ChatListItem {
  members: ChatMember[];
  currentRole: ChatMemberRole;
  canManageMembers: boolean;
}

export interface ChatAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  authorId: string | null;
  authorName: string;
  text: string | null;
  messageType: ChatMessageType;
  systemEvent: SystemMessageEvent | null;
  replyToMessageId: string | null;
  createdAt: string;
  deletedAt: string | null;
  deletedById: string | null;
  attachments: ChatAttachment[];
  canDelete: boolean;
}

export interface MessagePage {
  items: ChatMessage[];
  nextCursor: string | null;
}

export interface ChatUser {
  id: string;
  name: string;
}
