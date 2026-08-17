/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useACLRoleContext, useAclSnippets } from '@nocobase/client';
import { useCallback } from 'react';
import type { Identifier, OrganizationPermissions } from '../model/types';

const DEPARTMENTS_ACL_SNIPPET = 'pm.departments';
const USERS_ACL_SNIPPET = 'pm.users';

function actionFields(actionParameters: unknown): unknown[] | null {
  if (actionParameters === null || typeof actionParameters !== 'object' || Array.isArray(actionParameters)) {
    return null;
  }
  const whitelist = (actionParameters as Record<string, unknown>).whitelist;
  return Array.isArray(whitelist) ? whitelist : null;
}

export function useOrganizationPermissions(): OrganizationPermissions {
  const { allowAll, parseAction } = useACLRoleContext();
  const { allow: hasAclSnippet } = useAclSnippets();
  const hasDepartmentsSettingsAccess = hasAclSnippet(DEPARTMENTS_ACL_SNIPPET);
  const hasUsersSettingsAccess = hasAclSnippet(USERS_ACL_SNIPPET);
  const hasAction = useCallback(
    (actionPath: string, recordId?: Identifier): boolean =>
      Boolean(allowAll || parseAction(actionPath, { ignoreScope: !recordId, recordPkValue: recordId })),
    [allowAll, parseAction],
  );
  const hasFieldAction = useCallback(
    (actionPath: string, fieldName: string, recordId?: Identifier): boolean => {
      if (allowAll) {
        return true;
      }
      const actionParameters = parseAction(actionPath, { ignoreScope: !recordId, recordPkValue: recordId });
      if (!actionParameters) {
        return false;
      }
      const fields = actionFields(actionParameters);
      return fields === null || fields.includes(fieldName);
    },
    [allowAll, parseAction],
  );

  return {
    canViewDepartments: hasDepartmentsSettingsAccess || hasAction('departments:list'),
    canViewUsers: hasDepartmentsSettingsAccess || hasUsersSettingsAccess || hasAction('users:list'),
    canCreateEmployee:
      hasUsersSettingsAccess ||
      (hasFieldAction('users:create', 'nickname') &&
        hasFieldAction('users:create', 'email') &&
        hasFieldAction('users:create', 'username') &&
        hasFieldAction('users:create', 'password')),
    canCreateDepartment: (parentId) =>
      hasDepartmentsSettingsAccess ||
      (hasFieldAction('departments:create', 'title') &&
        (parentId === null || hasFieldAction('departments:create', 'parent'))),
    canUpdateDepartment: (departmentId) =>
      hasDepartmentsSettingsAccess || hasFieldAction('departments:update', 'title', departmentId),
    canMoveDepartment: (departmentId) =>
      hasDepartmentsSettingsAccess || hasFieldAction('departments:update', 'parent', departmentId),
    canDeleteDepartment: (departmentId) =>
      hasDepartmentsSettingsAccess || hasAction('departments:destroy', departmentId),
    canAssignEmployee: (employeeId) =>
      hasDepartmentsSettingsAccess || hasFieldAction('users:update', 'departments', employeeId),
    canMoveEmployee: (employeeId) =>
      hasDepartmentsSettingsAccess || hasFieldAction('users:update', 'departments', employeeId),
    canRemoveEmployee: (employeeId) =>
      hasDepartmentsSettingsAccess || hasFieldAction('users:update', 'departments', employeeId),
    canTerminateEmployee: (employeeId) =>
      employeeId !== '1' && (hasUsersSettingsAccess || hasAction('users:destroy', employeeId)),
    canAddMembers: (departmentId) =>
      hasDepartmentsSettingsAccess || hasFieldAction('departments:update', 'members', departmentId),
    canAssignManager: (departmentId) =>
      hasDepartmentsSettingsAccess ||
      (hasFieldAction('departments:update', 'members', departmentId) &&
        hasFieldAction('departments:update', 'owners', departmentId)),
  };
}
