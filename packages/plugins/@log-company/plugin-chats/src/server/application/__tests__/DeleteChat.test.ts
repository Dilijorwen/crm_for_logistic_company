/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { DeleteChat } from '../DeleteChat';
import { ChatAccessService } from '../ChatAccessService';
import {
  activeMember,
  chatRecord,
  chatRepository,
  memberRepository,
  fixedClock,
  fixedDate,
  transactionManager,
} from './testDoubles';

function fixture(type: 'direct' | 'group', role: 'owner' | 'admin' | 'member') {
  const chats = chatRepository({ findById: vi.fn().mockResolvedValue(chatRecord({ type })), softDelete: vi.fn() });
  const members = memberRepository({ findMembership: vi.fn().mockResolvedValue(activeMember({ role })) });
  return {
    chats,
    members,
    useCase: new DeleteChat(new ChatAccessService(chats, members), chats, transactionManager(), fixedClock()),
  };
}

describe('DeleteChat', () => {
  it.each(['direct', 'group'] as const)('deletes an authorized %s chat transactionally', async (type) => {
    const { chats, useCase } = fixture(type, 'owner');
    await useCase.execute('100', '1');
    expect(chats.softDelete).toHaveBeenCalledWith('100', fixedDate, expect.any(Object));
  });

  it.each(['member', 'admin'] as const)('denies group deletion by %s', async (role) => {
    const { chats, useCase } = fixture('group', role);
    await expect(useCase.execute('100', '1')).rejects.toMatchObject({ code: 'CHAT_ACCESS_DENIED' });
    expect(chats.softDelete).not.toHaveBeenCalled();
  });

  it('denies deletion by an outsider', async () => {
    const { members, useCase } = fixture('direct', 'member');
    vi.mocked(members.findMembership).mockResolvedValue(null);
    await expect(useCase.execute('100', '3')).rejects.toMatchObject({ code: 'CHAT_ACCESS_DENIED' });
  });

  it('returns not found for a missing or previously deleted chat', async () => {
    const { chats, useCase } = fixture('direct', 'member');
    vi.mocked(chats.findById)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(chatRecord({ deletedAt: fixedDate }));
    await expect(useCase.execute('100', '1')).rejects.toMatchObject({ code: 'CHAT_NOT_FOUND' });
    await expect(useCase.execute('100', '1')).rejects.toMatchObject({ code: 'CHAT_NOT_FOUND' });
  });

  it('propagates persistence failure without reporting a successful deletion', async () => {
    const { chats, useCase } = fixture('direct', 'member');
    vi.mocked(chats.softDelete).mockRejectedValue(new Error('database unavailable'));
    await expect(useCase.execute('100', '1')).rejects.toThrow('database unavailable');
  });
});
