/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { GetUnreadChatsCount } from '../GetUnreadChatsCount';
import { memberRepository } from './testDoubles';

describe('GetUnreadChatsCount', () => {
  it('returns the number of chats reported by the current user membership projection', async () => {
    let requestedUserId = '';
    const action = new GetUnreadChatsCount(
      memberRepository({
        countUnreadChats: async (userId) => {
          requestedUserId = userId;
          return 3;
        },
      }),
    );

    await expect(action.execute('42')).resolves.toBe(3);
    expect(requestedUserId).toBe('42');
  });
});
