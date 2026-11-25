/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { DocumentAccessRule, DocumentRight, DocumentRights, FolderAccess } from './processDocuments';

export function allowsSectionOperation(
  common: readonly DocumentAccessRule[],
  local: readonly DocumentAccessRule[],
  operation: DocumentRight,
  actor: { isRoot: boolean; roles?: readonly string[]; userId: string | null },
  defaultAllow: boolean | DocumentRights = true,
): boolean {
  if (actor.isRoot) return true;
  const activeRoles = actor.roles?.length ? actor.roles : [null];
  const find = (rules: readonly DocumentAccessRule[], kind: DocumentAccessRule['kind'], subject: string | null) =>
    rules.find((rule) => rule.kind === kind && rule.subject === subject)?.rights;
  const companyUser = find(local, 'user', actor.userId);
  const commonUser = find(common, 'user', actor.userId);
  return activeRoles.some((role) => {
    const companyRole = find(local, 'role', role);
    const commonRole = find(common, 'role', role);
    const allowed = (right: DocumentRight) =>
      companyUser?.[right] ??
      companyRole?.[right] ??
      commonUser?.[right] ??
      commonRole?.[right] ??
      (typeof defaultAllow === 'boolean' ? defaultAllow : defaultAllow[right] ?? true);
    return allowed('read') && allowed(operation);
  });
}

const levels = { read: 1, write: 2, delete: 3 } as const;

export function allowsFolderOperation(
  grants: FolderAccess | null | undefined,
  operation: DocumentRight,
  actor: { isRoot: boolean; userId: string | null; roles?: readonly string[] },
): boolean {
  if (actor.isRoot || grants == null) return true;
  if (!Array.isArray(grants)) {
    return allowsSectionOperation([], grants.rules, operation, actor, grants.defaultAllow);
  }
  return grants.some(
    (grant) =>
      (grant.kind === 'user' ? grant.subject === actor.userId : actor.roles?.includes(grant.subject)) &&
      levels[grant.level] >= levels[operation === 'rename' ? 'write' : operation],
  );
}
