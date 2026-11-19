/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { DocumentAccessRule, DocumentRight } from '../../../contracts/processDocuments';

export function allowsSectionOperation(
  common: readonly DocumentAccessRule[],
  local: readonly DocumentAccessRule[],
  operation: DocumentRight,
  actor: { isRoot: boolean; roles?: readonly string[]; userId: string | null },
  defaultAllow = true,
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
      companyUser?.[right] ?? companyRole?.[right] ?? commonUser?.[right] ?? commonRole?.[right] ?? defaultAllow;
    return allowed('read') && allowed(operation);
  });
}
