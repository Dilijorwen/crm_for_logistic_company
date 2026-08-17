/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import type { ChatUser, UserDirectory } from '../../application/ports/UserDirectory';
import type { TransactionContext } from '../../application/ports/TransactionManager';
import { NocoBaseTransactionManager } from './NocoBaseTransactionManager';

interface UserRow {
  id: string | number | bigint;
  nickname: string | null;
  username: string | null;
}

export class NocoBaseUserDirectory implements UserDirectory {
  constructor(private readonly plugin: Plugin) {}

  async findById(userId: string, transaction?: TransactionContext): Promise<ChatUser | null> {
    const users = await this.findByIds([userId], transaction);
    return users[0] || null;
  }

  async findByIds(userIds: string[], transaction?: TransactionContext): Promise<ChatUser[]> {
    if (!userIds.length) {
      return [];
    }
    const [rows] = (await this.plugin.db.sequelize.query(
      `select id, nickname, username from users where id in (:userIds) order by id`,
      {
        replacements: { userIds },
        transaction: NocoBaseTransactionManager.asTransaction(transaction),
      },
    )) as unknown as [UserRow[], unknown];
    return rows.map((row) => this.mapUser(row));
  }

  async search(query: string, excludedUserId: string, limit: number): Promise<ChatUser[]> {
    const escaped = query.replace(/[\\%_]/g, '\\$&');
    const pattern = `%${escaped}%`;
    const [rows] = (await this.plugin.db.sequelize.query(
      `
        select id, nickname, username
        from users
        where id <> :excludedUserId
          and (:query = '' or nickname ilike :pattern escape '\\' or username ilike :pattern escape '\\')
        order by coalesce(nullif(btrim(nickname), ''), username, id::text), id
        limit :limit
      `,
      { replacements: { excludedUserId, query, pattern, limit } },
    )) as unknown as [UserRow[], unknown];
    return rows.map((row) => this.mapUser(row));
  }

  private mapUser(row: UserRow): ChatUser {
    const id = String(row.id);
    return { id, name: row.nickname?.trim() || row.username?.trim() || id };
  }
}
