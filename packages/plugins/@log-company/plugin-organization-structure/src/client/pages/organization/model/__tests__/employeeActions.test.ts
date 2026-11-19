/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import { bindEmployeeActions, type EmployeeActionHandlers } from '../employeeActions';
import type { OrganizationEmployee, OrganizationPermissions } from '../types';

const employee: OrganizationEmployee = {
  id: 'employee-1',
  nickname: 'Анна',
  username: 'anna',
  email: 'anna@example.test',
  mainDepartmentId: null,
  roles: [],
  departments: [],
};

const permissions: OrganizationPermissions = {
  canViewDepartments: true,
  canViewUsers: true,
  canCreateEmployee: false,
  canCreateDepartment: () => false,
  canUpdateDepartment: () => false,
  canMoveDepartment: () => false,
  canDeleteDepartment: () => false,
  canAssignEmployee: () => false,
  canMoveEmployee: () => false,
  canRemoveEmployee: () => false,
  canTerminateEmployee: () => false,
  canEditEmployeeRoles: () => false,
  canAddMembers: () => false,
  canAssignManager: () => false,
};

const employeeActions = [
  ['onEditRoles', 'canEditEmployeeRoles'],
  ['onAssign', 'canAssignEmployee'],
  ['onMove', 'canMoveEmployee'],
  ['onRemove', 'canRemoveEmployee'],
  ['onTerminate', 'canTerminateEmployee'],
] as const;

describe('employee action permissions', () => {
  it.each(employeeActions)('binds %s only when its employee permission allows it', (action, permission) => {
    const handle = vi.fn();
    const handlers: EmployeeActionHandlers = { [action]: handle };
    expect(bindEmployeeActions(employee, permissions, handlers)[action]).toBeUndefined();

    const scopedPermissions = { ...permissions, [permission]: (id: string) => id === employee.id };
    const bound = bindEmployeeActions(employee, scopedPermissions, handlers);
    bound[action]?.();
    expect(handle).toHaveBeenCalledOnce();
    expect(handle).toHaveBeenCalledWith(employee);
    expect(bindEmployeeActions({ ...employee, id: 'other' }, scopedPermissions, handlers)[action]).toBeUndefined();
  });

  it('keeps opening details independent from mutation permissions', () => {
    const onOpen = vi.fn();
    bindEmployeeActions(employee, permissions, { onOpen }).onOpen?.();
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onOpen).toHaveBeenCalledWith(employee);
  });

  it('checks the target department before offering manager assignment', () => {
    const onMakeManager = vi.fn();
    const scopedPermissions = { ...permissions, canAssignManager: (id?: string) => id === 'department-1' };
    expect(
      bindEmployeeActions(employee, scopedPermissions, { onMakeManager }, 'department-2').onMakeManager,
    ).toBeUndefined();
    bindEmployeeActions(employee, scopedPermissions, { onMakeManager }, 'department-1').onMakeManager?.();
    expect(onMakeManager).toHaveBeenCalledOnce();
    expect(onMakeManager).toHaveBeenCalledWith(employee);
    expect(bindEmployeeActions(employee, scopedPermissions, {}, 'department-1').onMakeManager).toBeUndefined();
  });
});
