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
import type { OrganizationEmployee } from '../../model/types';

vi.mock('../../../../locale', () => ({
  useOrganizationTranslation: () => ({ t: (key: string) => key }),
}));

import { UserDetailsModal } from '../DetailsModals';
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
});
