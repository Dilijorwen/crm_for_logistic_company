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
import { ChatAccessService } from '../ChatAccessService';
import { GetChatMessages } from '../GetChatMessages';
import { decodeMessageCursor, encodeMessageCursor } from '../MessageCursorCodec';
import {
  activeMember,
  attachmentRepository,
  chatMessage,
  chatRecord,
  chatRepository,
  memberRepository,
  messageRepository,
} from './testDoubles';

describe('message cursor pagination', () => {
  it('round-trips an opaque cursor and rejects malformed input', () => {
    const cursor = { createdAt: '2026-07-17T03:00:00.000Z', id: '123456' };
    expect(decodeMessageCursor(encodeMessageCursor(cursor))).toEqual(cursor);
    expect(() => decodeMessageCursor('not-a-cursor')).toThrow(ChatValidationError);
  });

  it('returns a stable next cursor from the oldest item in the page', async () => {
    const chats = chatRepository({ findById: async () => chatRecord() });
    const members = memberRepository({ findMembership: async () => activeMember() });
    const rows = [
      chatMessage({ id: '503', createdAt: '2026-07-17T03:03:00.000Z' }),
      chatMessage({ id: '502', createdAt: '2026-07-17T03:02:00.000Z' }),
      chatMessage({ id: '501', createdAt: '2026-07-17T03:01:00.000Z' }),
    ];
    const action = new GetChatMessages(
      new ChatAccessService(chats, members),
      messageRepository({ list: async () => rows }),
      attachmentRepository(),
    );

    const page = await action.execute({
      chatId: '100',
      actorId: '1',
      cursor: null,
      beforeId: null,
      limit: 2,
    });

    expect(page.items.map((message) => message.id)).toEqual(['503', '502']);
    expect(decodeMessageCursor(page.nextCursor)).toEqual({
      createdAt: '2026-07-17T03:02:00.000Z',
      id: '502',
    });
  });
});
