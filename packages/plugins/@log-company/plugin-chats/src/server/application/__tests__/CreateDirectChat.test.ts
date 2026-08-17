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
import { CreateDirectChat } from '../CreateDirectChat';
import {
  chatListItem,
  chatRecord,
  chatRepository,
  fixedClock,
  memberRepository,
  sequentialIds,
  transactionManager,
  userDirectory,
} from './testDoubles';

describe('CreateDirectChat', () => {
  it('returns an existing direct chat without creating another one', async () => {
    const existing = chatRecord();
    let createCalls = 0;
    const chats = chatRepository({
      findByDirectKey: async () => existing,
      getListItem: async () => chatListItem(existing),
      createDirectIfAbsent: async () => {
        createCalls += 1;
        return null;
      },
    });
    const action = new CreateDirectChat(
      chats,
      memberRepository(),
      userDirectory(),
      transactionManager(),
      fixedClock(),
      sequentialIds(),
    );

    await expect(action.execute({ actorId: '1', otherUserId: '2' })).resolves.toMatchObject({ id: existing.id });
    expect(createCalls).toBe(0);
  });

  it('creates a chat and both memberships in one transaction', async () => {
    const created = chatRecord({ id: '1000' });
    const createdMembers: ChatMemberDto[] = [];
    const chats = chatRepository({
      createDirectIfAbsent: async () => created,
      getListItem: async () => chatListItem(created),
    });
    const members = memberRepository({
      create: async (input) => {
        const member: ChatMemberDto = {
          id: input.id,
          userId: input.userId,
          memberName: input.memberName,
          role: input.role,
          joinedAt: input.joinedAt,
          leftAt: null,
          lastReadAt: input.lastReadAt,
          isMuted: false,
          deleted: false,
        };
        createdMembers.push(member);
        return member;
      },
    });
    const action = new CreateDirectChat(
      chats,
      members,
      userDirectory(),
      transactionManager(),
      fixedClock(),
      sequentialIds(),
    );

    const result = await action.execute({ actorId: '1', otherUserId: '2' });

    expect(result.id).toBe(created.id);
    expect(createdMembers.map((member) => member.userId)).toEqual(['1', '2']);
  });

  it('returns the winning chat after a concurrent insert conflict', async () => {
    const winner = chatRecord({ id: '2222' });
    let lookup = 0;
    const chats = chatRepository({
      findByDirectKey: async () => {
        lookup += 1;
        return lookup === 1 ? null : winner;
      },
      createDirectIfAbsent: async () => null,
      getListItem: async () => chatListItem(winner),
    });
    const action = new CreateDirectChat(
      chats,
      memberRepository(),
      userDirectory(),
      transactionManager(),
      fixedClock(),
      sequentialIds(),
    );

    await expect(action.execute({ actorId: '1', otherUserId: '2' })).resolves.toMatchObject({ id: winner.id });
  });
});
