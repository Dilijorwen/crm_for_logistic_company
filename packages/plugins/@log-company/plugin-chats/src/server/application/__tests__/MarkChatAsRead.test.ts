/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import type { ChatMemberDto } from '../dto/ChatDto';
import { ChatAccessService } from '../ChatAccessService';
import { MarkChatAsRead } from '../MarkChatAsRead';
import { chatRecord, chatRepository, fixedClock, fixedDate, memberRepository, transactionManager } from './testDoubles';

const activeMember: ChatMemberDto = {
  id: '10',
  userId: '1',
  memberName: 'First user',
  role: 'member',
  joinedAt: fixedDate,
  leftAt: null,
  lastReadAt: null,
  isMuted: false,
  deleted: false,
};

describe('MarkChatAsRead', () => {
  it('updates only the current user membership', async () => {
    const updates: Array<{ chatId: string; userId: string }> = [];
    const chats = chatRepository({ findById: async () => chatRecord() });
    const members = memberRepository({
      findMembership: async () => activeMember,
      markRead: async (chatId, userId) => {
        updates.push({ chatId, userId });
      },
    });
    const action = new MarkChatAsRead(
      new ChatAccessService(chats, members),
      members,
      transactionManager(),
      fixedClock(),
    );

    await action.execute('100', '1');

    expect(updates).toEqual([{ chatId: '100', userId: '1' }]);
  });
});
