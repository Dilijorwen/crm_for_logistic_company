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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrganizationDepartment, OrganizationPermissions } from '../../model/types';

vi.mock('../../../../locale', () => ({
  useOrganizationTranslation: () => ({ t: (key: string) => key }),
}));

import { OrganizationCanvas } from '../OrganizationCanvas';

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

describe('OrganizationCanvas', () => {
  const setPointerCapture = vi.fn();

  beforeEach(() => {
    setPointerCapture.mockClear();
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: setPointerCapture,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture');
  });

  it('does not capture pointer events emitted by a dropdown portal', async () => {
    const onEdit = vi.fn();
    render(
      <OrganizationCanvas
        departments={[department]}
        permissions={permissions}
        selectedDepartmentId={null}
        focusTarget={null}
        onSelect={vi.fn()}
        onCreateRoot={vi.fn()}
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
    fireEvent.pointerDown(editItem, { button: 0, pointerId: 1 });
    fireEvent.click(editItem);

    expect(setPointerCapture).not.toHaveBeenCalled();
    expect(onEdit).toHaveBeenCalledOnce();
  });
});
