/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Model, Transaction } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import type { HandleDeletedUser } from '../../application/HandleDeletedUser';

interface DestroyOptions {
  transaction?: Transaction;
}

export class ChatUserHooks {
  constructor(
    private readonly plugin: Plugin,
    private readonly handleDeletedUser: HandleDeletedUser,
  ) {}

  register(): void {
    this.plugin.db.on('users.beforeDestroy', this.beforeUserDestroy);
  }

  private readonly beforeUserDestroy = async (user: Model, options: DestroyOptions): Promise<void> => {
    const userId = user.get('id');
    if (userId !== null && userId !== undefined) {
      await this.handleDeletedUser.execute(String(userId), options.transaction);
    }
  };
}
