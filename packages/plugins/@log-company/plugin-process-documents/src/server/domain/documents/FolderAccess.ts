/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { FolderAccess } from '../../../contracts/processDocuments';
import { allowsSectionOperation } from './DocumentAccessRules';

const levels = { read: 1, write: 2, delete: 3 } as const;

export function allowsFolderOperation(
  grants: FolderAccess | null | undefined,
  operation: keyof typeof levels,
  actor: { isRoot: boolean; userId: string | null; roles?: readonly string[] },
): boolean {
  if (actor.isRoot || grants == null) return true;
  if (!Array.isArray(grants)) {
    return allowsSectionOperation([], grants.rules, operation, actor, grants.defaultAllow);
  }
  return grants.some(
    (grant) =>
      (grant.kind === 'user' ? grant.subject === actor.userId : actor.roles?.includes(grant.subject)) &&
      levels[grant.level] >= levels[operation],
  );
}
