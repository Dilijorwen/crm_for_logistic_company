/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { ProcessModelContext } from './recordContext';

export function getProcessBlockModelContext(
  model: unknown,
  context: ProcessModelContext & {
    view?: { inputArgs?: { collectionName?: string; filterByTk?: unknown } };
  },
): ProcessModelContext {
  const viewInputArgs = context.view?.inputArgs;
  return {
    collection: viewInputArgs?.collectionName ?? context.collection,
    record: context.record,
    filterByTk: viewInputArgs?.filterByTk ?? context.filterByTk,
    params: context.params,
    model,
  };
}
