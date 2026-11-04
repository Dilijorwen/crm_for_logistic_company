/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const aclMocks = vi.hoisted(() => ({
  allowAll: false,
  hasAclSnippet: vi.fn(),
  parseAction: vi.fn(),
}));

vi.mock('@nocobase/client', () => ({
  useACLRoleContext: () => ({
    allowAll: aclMocks.allowAll,
    parseAction: aclMocks.parseAction,
  }),
  useAclSnippets: () => ({
    allow: aclMocks.hasAclSnippet,
  }),
}));

import { useOrganizationPermissions } from '../useOrganizationPermissions';

describe('useOrganizationPermissions', () => {
  beforeEach(() => {
    aclMocks.allowAll = false;
    aclMocks.hasAclSnippet.mockReset().mockReturnValue(false);
    aclMocks.parseAction.mockReset().mockReturnValue(null);
  });

  it('enables organization management for a role with the standard departments settings permission', () => {
    aclMocks.hasAclSnippet.mockImplementation((snippet: string) => snippet === 'pm.departments');

    const { result } = renderHook(() => useOrganizationPermissions());
    const permissions = result.current;

    expect(permissions.canViewDepartments).toBe(true);
    expect(permissions.canViewUsers).toBe(true);
    expect(permissions.canCreateEmployee).toBe(false);
    expect(permissions.canCreateDepartment(null)).toBe(true);
    expect(permissions.canCreateDepartment('department-1')).toBe(true);
    expect(permissions.canUpdateDepartment('department-1')).toBe(true);
    expect(permissions.canMoveDepartment('department-1')).toBe(true);
    expect(permissions.canDeleteDepartment('department-1')).toBe(true);
    expect(permissions.canAssignEmployee('user-1')).toBe(true);
    expect(permissions.canMoveEmployee('user-1')).toBe(true);
    expect(permissions.canRemoveEmployee('user-1')).toBe(true);
    expect(permissions.canTerminateEmployee('user-1')).toBe(false);
    expect(permissions.canAddMembers('department-1')).toBe(true);
    expect(permissions.canAssignManager('department-1')).toBe(true);
  });

  it('uses the users settings permission for viewing and creating users', () => {
    aclMocks.hasAclSnippet.mockImplementation((snippet: string) => snippet === 'pm.users');

    const { result } = renderHook(() => useOrganizationPermissions());
    const permissions = result.current;

    expect(permissions.canViewUsers).toBe(true);
    expect(permissions.canCreateEmployee).toBe(true);
    expect(permissions.canViewDepartments).toBe(false);
    expect(permissions.canAssignEmployee('user-1')).toBe(false);
    expect(permissions.canTerminateEmployee('user-2')).toBe(true);
    expect(permissions.canTerminateEmployee('1')).toBe(false);
  });

  it('maps association mutations to update permissions on their source collections', () => {
    aclMocks.parseAction.mockImplementation((actionPath: string) => {
      const permissions: Record<string, Record<string, unknown>> = {
        'departments:list': {},
        'departments:create': { whitelist: ['title', 'parent'] },
        'departments:update': { whitelist: ['title', 'parent', 'members', 'owners'] },
        'departments:destroy': {},
        'users:list': {},
        'users:create': { whitelist: ['nickname', 'email', 'username', 'password'] },
        'users:update': { whitelist: ['departments'] },
        'users:destroy': {},
      };
      return permissions[actionPath] ?? null;
    });

    const { result } = renderHook(() => useOrganizationPermissions());
    const permissions = result.current;

    expect(permissions.canCreateDepartment('department-1')).toBe(true);
    expect(permissions.canCreateEmployee).toBe(true);
    expect(permissions.canUpdateDepartment('department-1')).toBe(true);
    expect(permissions.canMoveDepartment('department-1')).toBe(true);
    expect(permissions.canAssignEmployee('user-1')).toBe(true);
    expect(permissions.canTerminateEmployee('user-1')).toBe(true);
    expect(permissions.canAddMembers('department-1')).toBe(true);
    expect(permissions.canAssignManager('department-1')).toBe(true);
    expect(aclMocks.parseAction).not.toHaveBeenCalledWith(
      expect.stringMatching(/^(users\.departments|departments\.members):/),
      expect.anything(),
    );
  });

  it('respects field whitelists for department and membership mutations', () => {
    aclMocks.parseAction.mockImplementation((actionPath: string) => {
      const permissions: Record<string, Record<string, unknown>> = {
        'departments:create': { whitelist: ['title'] },
        'departments:update': { whitelist: ['title'] },
        'users:update': { whitelist: ['nickname'] },
        'users:create': { whitelist: ['nickname', 'email', 'username'] },
      };
      return permissions[actionPath] ?? null;
    });

    const { result } = renderHook(() => useOrganizationPermissions());
    const permissions = result.current;

    expect(permissions.canCreateDepartment(null)).toBe(true);
    expect(permissions.canCreateEmployee).toBe(false);
    expect(permissions.canCreateDepartment('department-1')).toBe(false);
    expect(permissions.canUpdateDepartment('department-1')).toBe(true);
    expect(permissions.canMoveDepartment('department-1')).toBe(false);
    expect(permissions.canAssignEmployee('user-1')).toBe(false);
    expect(permissions.canTerminateEmployee('user-1')).toBe(false);
    expect(permissions.canAddMembers('department-1')).toBe(false);
    expect(permissions.canAssignManager('department-1')).toBe(false);
  });

  it('allows every operation for the root role', () => {
    aclMocks.allowAll = true;

    const { result } = renderHook(() => useOrganizationPermissions());

    expect(result.current.canCreateDepartment('department-1')).toBe(true);
    expect(result.current.canCreateEmployee).toBe(true);
    expect(result.current.canMoveDepartment('department-1')).toBe(true);
    expect(result.current.canAssignEmployee('user-1')).toBe(true);
    expect(result.current.canTerminateEmployee('user-1')).toBe(true);
    expect(result.current.canTerminateEmployee('1')).toBe(false);
    expect(result.current.canAssignManager('department-1')).toBe(true);
  });
});
