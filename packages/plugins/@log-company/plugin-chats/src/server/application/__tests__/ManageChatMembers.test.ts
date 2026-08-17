/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { parseSystemMessage } from '../../domain/chat/SystemMessage';
import { AddChatMembers } from '../AddChatMembers';
import { ChatAccessService } from '../ChatAccessService';
import { RemoveChatMember } from '../RemoveChatMember';
import type { ChatMessageDto } from '../dto/ChatDto';
import {
  activeMember,
  chatMessage,
  chatRecord,
  chatRepository,
  fixedClock,
  memberRepository,
  messageRepository,
  sequentialIds,
  transactionManager,
  userDirectory,
} from './testDoubles';

function setupAccess() {
  const chats = chatRepository({
    findById: async () => chatRecord({ type: 'group', title: 'Team', directKey: null }),
    updateLastMessageAt: async () => undefined,
  });
  const members = memberRepository({
    findMembership: async () => activeMember({ role: 'owner' }),
  });
  return { chats, members, access: new ChatAccessService(chats, members) };
}

describe('group membership management', () => {
  it('adds a participant and records a system message in the same transaction', async () => {
    const { chats, members, access } = setupAccess();
    const systemMessages: ChatMessageDto[] = [];
    const action = new AddChatMembers(
      access,
      chats,
      memberRepository({
        ...members,
        findMembership: members.findMembership,
        createIfAbsent: async (input) =>
          activeMember({ id: input.id, userId: input.userId, memberName: input.memberName }),
      }),
      messageRepository({
        create: async (input) => {
          const message = chatMessage({
            id: input.id,
            chatId: input.chatId,
            authorId: input.authorId,
            authorName: input.authorName,
            text: input.text,
            messageType: input.messageType,
          });
          systemMessages.push(message);
          return message;
        },
      }),
      userDirectory(),
      transactionManager(),
      fixedClock(),
      sequentialIds(),
    );

    await action.execute({ chatId: '100', actorId: '1', userIds: ['2'] });

    expect(systemMessages).toHaveLength(1);
    expect(parseSystemMessage(systemMessages[0].text)).toMatchObject({
      key: 'memberAdded',
      actorName: 'First user',
      subjectName: 'Second user',
    });
  });

  it('does not duplicate a system message when a concurrent invitation already won', async () => {
    const { chats, members, access } = setupAccess();
    let systemMessages = 0;
    const action = new AddChatMembers(
      access,
      chats,
      memberRepository({
        ...members,
        findMembership: members.findMembership,
        createIfAbsent: async () => null,
      }),
      messageRepository({
        create: async () => {
          systemMessages += 1;
          return chatMessage();
        },
      }),
      userDirectory(),
      transactionManager(),
      fixedClock(),
      sequentialIds(),
    );

    await action.execute({ chatId: '100', actorId: '1', userIds: ['2'] });

    expect(systemMessages).toBe(0);
  });

  it('removes a participant and records a system message', async () => {
    const { chats, members, access } = setupAccess();
    const operations: string[] = [];
    const action = new RemoveChatMember(
      access,
      chats,
      memberRepository({
        ...members,
        findMembership: members.findMembership,
        findActive: async () => activeMember({ id: '20', userId: '2', memberName: 'Second user' }),
        markLeft: async () => {
          operations.push('left');
        },
      }),
      messageRepository({
        create: async (input) => {
          operations.push(parseSystemMessage(input.text)?.key || 'invalid');
          return chatMessage({ id: input.id, text: input.text, messageType: 'system' });
        },
      }),
      userDirectory(),
      transactionManager(),
      fixedClock(),
      sequentialIds(),
    );

    await action.execute({ chatId: '100', actorId: '1', userId: '2' });

    expect(operations).toEqual(['left', 'memberRemoved']);
  });
});
