/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import {
  ChatAccessDeniedError,
  ChatOwnerRemovalForbiddenError,
  DirectChatWithSelfError,
  MessageAlreadyDeletedError,
  MessageDeleteForbiddenError,
} from '../ChatErrors';
import {
  assertCanDeleteMessage,
  assertCanManageMembers,
  assertMemberCanBeRemoved,
  createDirectChatKey,
} from '../ChatPolicy';

describe('ChatPolicy', () => {
  it('builds one stable direct key for either participant order', () => {
    expect(createDirectChatKey('42', '17')).toBe('17:42');
    expect(createDirectChatKey('17', '42')).toBe('17:42');
  });

  it('forbids a direct chat with the same user', () => {
    expect(() => createDirectChatKey('17', '17')).toThrow(DirectChatWithSelfError);
  });

  it.each(['owner', 'admin'] as const)('allows the %s role to manage members', (role) => {
    expect(() => assertCanManageMembers(role)).not.toThrow();
  });

  it('does not let a regular member manage members', () => {
    expect(() => assertCanManageMembers('member')).toThrow(ChatAccessDeniedError);
  });

  it('requires ownership transfer before removing an owner', () => {
    expect(() => assertMemberCanBeRemoved('owner')).toThrow(ChatOwnerRemovalForbiddenError);
  });

  it('lets an author delete an existing message', () => {
    expect(() => assertCanDeleteMessage('10', '10', null)).not.toThrow();
  });

  it('forbids deleting another author message', () => {
    expect(() => assertCanDeleteMessage('10', '11', null)).toThrow(MessageDeleteForbiddenError);
  });

  it('forbids deleting a message twice', () => {
    expect(() => assertCanDeleteMessage('10', '10', new Date())).toThrow(MessageAlreadyDeletedError);
  });
});
