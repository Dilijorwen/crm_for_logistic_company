/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { fireEvent, render, screen, within } from '@nocobase/test/client';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { OrganizationDepartment, OrganizationEmployee, OrganizationPermissions } from '../../model/types';

vi.mock('../../../../shared/lib', () => ({
  useOrganizationTranslation: () => ({ t: (key: string) => key }),
}));

import { DepartmentCard } from '../DepartmentCard';
import { DepartmentMembersModal } from '../DetailsModals';
import { EmployeeSidebar } from '../EmployeeSidebar';

const owner: OrganizationEmployee = {
  id: 'owner',
  nickname: 'Руководитель',
  username: 'owner',
  email: 'owner@example.test',
  mainDepartmentId: null,
  roles: [],
  departments: [],
};
const member: OrganizationEmployee = {
  id: 'member',
  nickname: 'Сотрудник',
  username: 'member',
  email: 'member@example.test',
  mainDepartmentId: null,
  roles: [],
  departments: [],
};
const department: OrganizationDepartment = {
  id: 'department-1',
  title: 'Логистика',
  parentId: null,
  isLeaf: true,
  sort: 1,
  owners: [owner],
  members: [owner, member],
};
const permissions: OrganizationPermissions = {
  canViewDepartments: true,
  canViewUsers: true,
  canCreateEmployee: false,
  canCreateDepartment: () => false,
  canUpdateDepartment: () => false,
  canMoveDepartment: () => false,
  canDeleteDepartment: () => false,
  canAssignEmployee: () => true,
  canMoveEmployee: () => true,
  canRemoveEmployee: () => false,
  canTerminateEmployee: () => false,
  canEditEmployeeRoles: () => false,
  canAddMembers: () => false,
  canAssignManager: (id) => id === department.id,
};

async function openEmployeeMenu(employee: OrganizationEmployee) {
  fireEvent.click(screen.getByRole('button', { name: `common.actions ${employee.nickname}` }));
  return within(await screen.findByRole('menu'));
}

describe('employee action contexts', () => {
  it('offers manager assignment to card members but not to the existing manager', async () => {
    const onMakeManager = vi.fn();
    const onOpenEmployee = vi.fn();
    render(
      <DepartmentCard
        department={department}
        permissions={permissions}
        selected={false}
        branchExpanded={false}
        hasChildren={false}
        setCardRef={vi.fn()}
        onSelect={vi.fn()}
        onToggleBranch={vi.fn()}
        onCreateChild={vi.fn()}
        onEdit={vi.fn()}
        onMove={vi.fn()}
        onDelete={vi.fn()}
        onAssignManager={vi.fn()}
        onAddEmployees={vi.fn()}
        onShowMembers={vi.fn()}
        onOpenEmployee={onOpenEmployee}
        onEditEmployeeRoles={vi.fn()}
        onMoveEmployee={vi.fn()}
        onRemoveEmployee={vi.fn()}
        onTerminateEmployee={vi.fn()}
        onMakeManager={onMakeManager}
      />,
    );
    const ownerMenu = await openEmployeeMenu(owner);
    expect(ownerMenu.queryByRole('menuitem', { name: 'employees.makeManager' })).not.toBeInTheDocument();
    fireEvent.click(ownerMenu.getByRole('menuitem', { name: 'employees.open' }));
    expect(onOpenEmployee).toHaveBeenCalledOnce();
    expect(onOpenEmployee).toHaveBeenCalledWith(owner);

    const memberMenu = await openEmployeeMenu(member);
    fireEvent.click(memberMenu.getByRole('menuitem', { name: 'employees.makeManager' }));
    expect(onMakeManager).toHaveBeenCalledOnce();
    expect(onMakeManager).toHaveBeenCalledWith(member);
  });

  it('keeps denied mutations out of the department member dialog', async () => {
    const onEditEmployeeRoles = vi.fn();
    render(
      <DepartmentMembersModal
        department={{ ...department, members: [member] }}
        permissions={{
          ...permissions,
          canMoveEmployee: () => false,
          canAssignManager: () => false,
          canEditEmployeeRoles: (id) => id === member.id,
        }}
        onClose={vi.fn()}
        onOpenEmployee={vi.fn()}
        onEditEmployeeRoles={onEditEmployeeRoles}
        onMoveEmployee={vi.fn()}
        onRemoveEmployee={vi.fn()}
        onTerminateEmployee={vi.fn()}
        onMakeManager={vi.fn()}
      />,
    );
    const menu = await openEmployeeMenu(member);
    expect(menu.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['employees.open', 'Изменить роли']);
    fireEvent.click(menu.getByRole('menuitem', { name: 'Изменить роли' }));
    expect(onEditEmployeeRoles).toHaveBeenCalledOnce();
    expect(onEditEmployeeRoles).toHaveBeenCalledWith(member);
  });

  it.each([false, true])('keeps sidebar assign/move context for an assigned employee: %s', async (assigned) => {
    const employee = { ...member, departments: assigned ? [{ id: department.id, title: department.title }] : [] };
    const onAssign = vi.fn();
    render(
      <EmployeeSidebar
        collapsed={false}
        employees={[employee]}
        search=""
        filter="all"
        loading={false}
        error={null}
        hasMore={false}
        permissions={permissions}
        onCollapsedChange={vi.fn()}
        onSearchChange={vi.fn()}
        onFilterChange={vi.fn()}
        onLoadMore={async () => undefined}
        onLocate={vi.fn()}
        onAssign={onAssign}
        onOpen={vi.fn()}
        onEditRoles={vi.fn()}
        onTerminate={vi.fn()}
        onCreate={vi.fn()}
      />,
    );
    const menu = await openEmployeeMenu(employee);
    expect(
      menu.queryByRole('menuitem', { name: assigned ? 'employees.assign' : 'employees.move' }),
    ).not.toBeInTheDocument();
    fireEvent.click(menu.getByRole('menuitem', { name: assigned ? 'employees.move' : 'employees.assign' }));
    expect(onAssign).toHaveBeenCalledOnce();
    expect(onAssign).toHaveBeenCalledWith(employee);
  });
});
