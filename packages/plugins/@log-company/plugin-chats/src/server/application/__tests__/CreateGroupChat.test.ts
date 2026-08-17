/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { ChatValidationError } from '../../domain/chat/ChatErrors';
import type { ChatMemberDto } from '../dto/ChatDto';
import { CreateGroupChat } from '../CreateGroupChat';
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

describe('CreateGroupChat', () => {
  it('requires at least one participant other than the creator', async () => {
    const action = new CreateGroupChat(
      chatRepository(),
      memberRepository(),
      userDirectory(),
      transactionManager(),
      fixedClock(),
      sequentialIds(),
    );

    await expect(action.execute({ actorId: '1', title: 'Operations', memberUserIds: ['1'] })).rejects.toBeInstanceOf(
      ChatValidationError,
    );
  });

  it('makes the creator owner and de-duplicates selected members', async () => {
    const created = chatRecord({ id: '1000', type: 'group', title: 'Operations', directKey: null });
    const memberships: ChatMemberDto[] = [];
    const action = new CreateGroupChat(
      chatRepository({ create: async () => created, getListItem: async () => chatListItem(created) }),
      memberRepository({
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
          memberships.push(member);
          return member;
        },
      }),
      userDirectory(),
      transactionManager(),
      fixedClock(),
      sequentialIds(),
    );

    await action.execute({ actorId: '1', title: ' Operations ', memberUserIds: ['2', '2'] });

    expect(memberships).toHaveLength(2);
    expect(memberships.find((member) => member.userId === '1')?.role).toBe('owner');
    expect(memberships.find((member) => member.userId === '2')?.role).toBe('member');
  });
});
