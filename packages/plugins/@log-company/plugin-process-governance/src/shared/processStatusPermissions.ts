/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export const PROCESS_STATUS_ROLE_NAMES = {
  manager: 'manager',
  managerIntern: 'r_fuxr3pxkc9o',
  declarant: 'declarant',
  declarantIntern: 'r_mo7pqlgcet3',
} as const;

export const MANAGER_EXCLUSIVE_PROCESS_STATUSES = ['queue', 'in_work', 'knr'] as const;
export const SHARED_PROCESS_STATUS = 'in_russia';
export const UNION_ROLE_NAME = '__union__';

const managerRoleNames = new Set<string>([PROCESS_STATUS_ROLE_NAMES.manager, PROCESS_STATUS_ROLE_NAMES.managerIntern]);
const declarantRoleNames = new Set<string>([
  PROCESS_STATUS_ROLE_NAMES.declarant,
  PROCESS_STATUS_ROLE_NAMES.declarantIntern,
]);
const managerExclusiveStatuses = new Set<string>(MANAGER_EXCLUSIVE_PROCESS_STATUSES);

function hasMatchingRole(roleNames: readonly string[], allowedRoleNames: ReadonlySet<string>): boolean {
  return roleNames.some((roleName) => allowedRoleNames.has(roleName));
}

export function hasProcessStatusWriteRole(roleNames: readonly string[]): boolean {
  return hasMatchingRole(roleNames, managerRoleNames) || hasMatchingRole(roleNames, declarantRoleNames);
}

export function resolveProcessStatusRoleNames(activeRoleName: unknown, assignedRoleNames: readonly string[]): string[] {
  if (activeRoleName === UNION_ROLE_NAME) {
    return [...assignedRoleNames];
  }
  return typeof activeRoleName === 'string' && activeRoleName ? [activeRoleName] : [];
}

export function canSetProcessStatus(roleNames: readonly string[], status: string): boolean {
  const isManager = hasMatchingRole(roleNames, managerRoleNames);
  if (isManager && (managerExclusiveStatuses.has(status) || status === SHARED_PROCESS_STATUS)) {
    return true;
  }

  const isDeclarant = hasMatchingRole(roleNames, declarantRoleNames);
  return isDeclarant && !managerExclusiveStatuses.has(status);
}
