/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { fireEvent, render, screen } from '@nocobase/test/client';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { OrganizationDepartment, OrganizationPermissions } from '../../model/types';

vi.mock('../../../../locale', () => ({
  useOrganizationTranslation: () => ({ t: (key: string) => key }),
}));

import { DepartmentCard } from '../DepartmentCard';

const department: OrganizationDepartment = {
  id: 'department-1',
  title: 'Operations',
  parentId: null,
  isLeaf: true,
  sort: 1,
  members: [],
  owners: [],
};

const permissions: OrganizationPermissions = {
  canViewDepartments: true,
  canViewUsers: true,
  canCreateEmployee: false,
  canCreateDepartment: () => false,
  canUpdateDepartment: () => true,
  canMoveDepartment: () => false,
  canDeleteDepartment: () => false,
  canAssignEmployee: () => false,
  canMoveEmployee: () => false,
  canRemoveEmployee: () => false,
  canTerminateEmployee: () => false,
  canAddMembers: () => false,
  canAssignManager: () => false,
};

describe('DepartmentCard', () => {
  it('runs a menu action once for a complete pointer click', async () => {
    const onEdit = vi.fn();
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
        onEdit={onEdit}
        onMove={vi.fn()}
        onDelete={vi.fn()}
        onAssignManager={vi.fn()}
        onAddEmployees={vi.fn()}
        onShowMembers={vi.fn()}
        onOpenEmployee={vi.fn()}
        onMoveEmployee={vi.fn()}
        onRemoveEmployee={vi.fn()}
        onTerminateEmployee={vi.fn()}
        onMakeManager={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'common.actions Operations' }));
    const editItem = await screen.findByText('departments.edit');
    fireEvent.mouseDown(editItem);
    fireEvent.click(editItem);

    expect(onEdit).toHaveBeenCalledOnce();
  });
});
