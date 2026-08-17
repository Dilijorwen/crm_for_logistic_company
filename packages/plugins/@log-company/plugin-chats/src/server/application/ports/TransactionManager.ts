/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export type TransactionContext = unknown;

export interface TransactionManager {
  execute<T>(
    work: (transaction: TransactionContext) => Promise<T>,
    existingTransaction?: TransactionContext,
  ): Promise<T>;
}
