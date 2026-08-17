/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Transaction } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import type { TransactionContext, TransactionManager } from '../../application/ports/TransactionManager';

export class NocoBaseTransactionManager implements TransactionManager {
  constructor(private readonly plugin: Plugin) {}

  execute<T>(
    work: (transaction: TransactionContext) => Promise<T>,
    existingTransaction?: TransactionContext,
  ): Promise<T> {
    if (existingTransaction) {
      return work(existingTransaction);
    }
    return this.plugin.db.sequelize.transaction((transaction) => work(transaction));
  }

  static asTransaction(transaction?: TransactionContext): Transaction | undefined {
    return transaction as Transaction | undefined;
  }
}
