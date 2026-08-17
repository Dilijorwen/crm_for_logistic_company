/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { HandleDeletedUser } from '../HandleDeletedUser';
import { chatRepository, fixedClock, memberRepository, messageRepository, transactionManager } from './testDoubles';

describe('HandleDeletedUser', () => {
  it('keeps history while anonymizing user references and ending memberships', async () => {
    const operations: string[] = [];
    const action = new HandleDeletedUser(
      chatRepository({
        anonymizeCreator: async () => {
          operations.push('chat');
        },
      }),
      memberRepository({
        deactivateUser: async () => {
          operations.push('membership');
        },
      }),
      messageRepository({
        anonymizeUser: async () => {
          operations.push('message');
        },
      }),
      transactionManager(),
      fixedClock(),
    );

    await action.execute('1');

    expect(operations).toEqual(['membership', 'message', 'chat']);
  });
});
