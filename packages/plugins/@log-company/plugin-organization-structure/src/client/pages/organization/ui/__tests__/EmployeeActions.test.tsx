/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { act, fireEvent, render, screen, waitFor } from '@nocobase/test/client';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { OrganizationEmployee } from '../../model/types';

vi.mock('../../../../shared/lib', () => ({
  useOrganizationTranslation: () => ({ t: (key: string) => key }),
}));

import { UserDetailsModal } from '../DetailsModals';
import { EditEmployeeRolesModal } from '../EditEmployeeRolesModal';
import { EmployeeListItem } from '../EmployeeListItem';

const employee: OrganizationEmployee = {
  id: 'user-2',
  nickname: 'Anna Employee',
  username: 'anna.employee',
  email: 'anna@example.test',
  mainDepartmentId: 'department-1',
  roles: [{ name: 'manager', title: 'Manager' }],
  departments: [{ id: 'department-1', title: 'Operations' }],
};

describe('employee actions and details', () => {
  it('shows roles above departments in the employee details', () => {
    render(<UserDetailsModal employee={employee} onClose={vi.fn()} />);

    expect(screen.getByText('Manager')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    const rolesLabel = screen.getByText('employees.roles');
    const departmentsLabel = screen.getByText('employees.departments');
    expect(rolesLabel.compareDocumentPosition(departmentsLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('runs the terminate callback once from the employee menu', async () => {
    const onTerminate = vi.fn();
    render(<EmployeeListItem employee={employee} onOpen={vi.fn()} onTerminate={onTerminate} />);

    fireEvent.click(screen.getByRole('button', { name: 'common.actions Anna Employee' }));
    fireEvent.click(await screen.findByText('employees.terminate'));

    expect(onTerminate).toHaveBeenCalledOnce();
  });

  it('opens the role editor through the employee menu when the action is provided', async () => {
    const onEditRoles = vi.fn();
    const { rerender } = render(<EmployeeListItem employee={employee} onOpen={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'common.actions Anna Employee' }));
    expect(screen.queryByRole('menuitem', { name: 'Изменить роли' })).not.toBeInTheDocument();

    rerender(<EmployeeListItem employee={employee} onOpen={vi.fn()} onEditRoles={onEditRoles} />);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Изменить роли' }));
    expect(onEditRoles).toHaveBeenCalledOnce();
  });

  it('preserves unavailable assignments and prevents duplicate saves', async () => {
    let finishSave: () => void;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        }),
    );
    render(
      <EditEmployeeRolesModal
        employeeId={employee.id}
        employeeName={employee.nickname}
        service={{
          getEmployeeRoles: async () => [{ name: 'hidden', title: 'Служебная роль' }],
          getAssignableRoles: async () => [{ name: 'manager', title: 'Менеджер' }],
        }}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    const save = screen.getByRole('button', { name: 'Сохранить' });
    expect(save).toBeDisabled();
    expect(await screen.findByText('Служебная роль')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Роли сотрудника' }));
    fireEvent.click(await screen.findByText('Менеджер'));
    fireEvent.click(save);
    fireEvent.click(save);

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith(['manager', 'hidden']);
    await act(async () => finishSave());
  });

  it('allows retrying a failed role lookup', async () => {
    const getEmployeeRoles = vi.fn().mockRejectedValueOnce(new Error('Forbidden')).mockResolvedValueOnce([]);
    render(
      <EditEmployeeRolesModal
        employeeId={employee.id}
        employeeName={employee.nickname}
        service={{ getEmployeeRoles, getAssignableRoles: async () => [] }}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(getEmployeeRoles).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('combobox', { name: 'Роли сотрудника' })).toBeDisabled();
  });
});
