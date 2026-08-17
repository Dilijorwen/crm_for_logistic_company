/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { CHAT_LIMITS } from '../../../shared/chatLimits';
import {
  ChatAccessDeniedError,
  ChatOwnerRemovalForbiddenError,
  ChatValidationError,
  DirectChatWithSelfError,
  MessageAlreadyDeletedError,
  MessageDeleteForbiddenError,
} from './ChatErrors';
import type { ChatMemberRole } from './ChatTypes';

function compareIdentifiers(left: string, right: string): number {
  if (left.length !== right.length) {
    return left.length - right.length;
  }
  return left.localeCompare(right);
}

export function createDirectChatKey(currentUserId: string, otherUserId: string): string {
  if (currentUserId === otherUserId) {
    throw new DirectChatWithSelfError();
  }
  return compareIdentifiers(currentUserId, otherUserId) < 0
    ? `${currentUserId}:${otherUserId}`
    : `${otherUserId}:${currentUserId}`;
}

export function normalizeGroupTitle(value: string): string {
  const title = value.trim();
  if (!title || title.length > CHAT_LIMITS.maximumGroupTitleLength) {
    throw new ChatValidationError();
  }
  return title;
}

export function normalizeMessageText(value: string | null | undefined, isRequired: boolean): string | null {
  const text = value?.trim() || '';
  if ((isRequired && !text) || text.length > CHAT_LIMITS.maximumMessageLength) {
    throw new ChatValidationError();
  }
  return text || null;
}

export function assertCanManageMembers(role: ChatMemberRole): void {
  if (role !== 'owner' && role !== 'admin') {
    throw new ChatAccessDeniedError();
  }
}

export function assertMemberCanBeRemoved(role: ChatMemberRole): void {
  if (role === 'owner') {
    throw new ChatOwnerRemovalForbiddenError();
  }
}

export function assertCanDeleteMessage(
  authorId: string | null,
  actorId: string,
  deletedAt: Date | string | null,
): void {
  if (deletedAt) {
    throw new MessageAlreadyDeletedError();
  }
  if (!authorId || authorId !== actorId) {
    throw new MessageDeleteForbiddenError();
  }
}
