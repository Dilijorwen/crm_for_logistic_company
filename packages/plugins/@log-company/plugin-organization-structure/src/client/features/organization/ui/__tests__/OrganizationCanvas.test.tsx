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

function firePointerEvent(
  element: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  init: { pointerId: number; button?: number; clientX?: number; clientY?: number },
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: init.button ?? 0,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
  });
  Object.defineProperty(event, 'pointerId', { value: init.pointerId });
  fireEvent(element, event);
}

describe('OrganizationCanvas', () => {
  const setPointerCapture = vi.fn();
  const releasePointerCapture = vi.fn();

  beforeEach(() => {
    setPointerCapture.mockClear();
    releasePointerCapture.mockClear();
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: setPointerCapture,
    });
    Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
      configurable: true,
      value: releasePointerCapture,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture');
    Reflect.deleteProperty(HTMLElement.prototype, 'releasePointerCapture');
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
    expect(editItem.closest('[data-interactive="true"]')).not.toBeNull();
    fireEvent.pointerDown(editItem, { button: 0, pointerId: 1 });
    fireEvent.click(editItem);

    expect(setPointerCapture).not.toHaveBeenCalled();
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('captures the pointer only after the user starts panning', () => {
    render(
      <OrganizationCanvas
        departments={[department]}
        permissions={permissions}
        selectedDepartmentId={null}
        focusTarget={null}
        onSelect={vi.fn()}
        onCreateRoot={vi.fn()}
        onCreateChild={vi.fn()}
        onEdit={vi.fn()}
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

    const canvas = screen.getByRole('main', { name: 'canvas.diagram' });
    firePointerEvent(canvas, 'pointerdown', { button: 0, pointerId: 2, clientX: 100, clientY: 100 });
    expect(setPointerCapture).not.toHaveBeenCalled();

    firePointerEvent(canvas, 'pointermove', { pointerId: 2, clientX: 110, clientY: 100 });
    expect(setPointerCapture).toHaveBeenCalledWith(2);

    firePointerEvent(canvas, 'pointerup', { pointerId: 2 });
    expect(releasePointerCapture).toHaveBeenCalledWith(2);
  });
});
