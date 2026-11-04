/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { FlowModel } from '@nocobase/flow-engine';
import type { TableIdentity } from '../../../shared/contracts';

export function tableIdentity(table: Pick<FlowModel, 'uid' | 'parent'>): TableIdentity {
  const referencePath: string[] = [];
  const visited = new Set<string>();
  let parent: FlowModel | null = table.parent;
  while (parent && !visited.has(parent.uid)) {
    visited.add(parent.uid);
    if (parent.use === 'ReferenceBlockModel') referencePath.unshift(parent.uid);
    parent = parent.parent;
  }
  return { tableUid: table.uid, referencePath };
}
