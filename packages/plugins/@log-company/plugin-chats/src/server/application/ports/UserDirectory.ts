/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { TransactionContext } from './TransactionManager';

export interface ChatUser {
  id: string;
  name: string;
}

export interface UserDirectory {
  findById(userId: string, transaction?: TransactionContext): Promise<ChatUser | null>;
  findByIds(userIds: string[], transaction?: TransactionContext): Promise<ChatUser[]>;
  search(query: string, excludedUserId: string, limit: number): Promise<ChatUser[]>;
}
