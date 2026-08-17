/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { ChatMemberInactiveError, UnavailableDirectChatError } from '../../domain/chat/ChatErrors';
import { ChatAccessService } from '../ChatAccessService';
import type { ChatMemberDto } from '../dto/ChatDto';
import { chatRecord, chatRepository, fixedDate, memberRepository } from './testDoubles';

function membership(overrides: Partial<ChatMemberDto> = {}): ChatMemberDto {
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

describe('ChatAccessService', () => {
  it('does not allow an inactive member to send messages', async () => {
    const access = new ChatAccessService(
      chatRepository({ findById: async () => chatRecord() }),
      memberRepository({ findMembership: async () => membership({ leftAt: fixedDate }) }),
    );

    await expect(access.requireAvailableSender('100', '1')).rejects.toBeInstanceOf(ChatMemberInactiveError);
  });

  it('does not allow sending to an unavailable direct-chat participant', async () => {
    const access = new ChatAccessService(
      chatRepository({ findById: async () => chatRecord() }),
      memberRepository({
        findMembership: async () => membership(),
        isDirectChatAvailable: async () => false,
      }),
    );

    await expect(access.requireAvailableSender('100', '1')).rejects.toBeInstanceOf(UnavailableDirectChatError);
  });
});
