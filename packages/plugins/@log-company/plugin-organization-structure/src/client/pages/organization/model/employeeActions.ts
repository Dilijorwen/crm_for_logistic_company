/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Identifier, OrganizationEmployee, OrganizationPermissions } from './types';

type EmployeeAction = (employee: OrganizationEmployee) => void;
export interface EmployeeActionHandlers {
  onOpen?: EmployeeAction;
  onEditRoles?: EmployeeAction;
  onAssign?: EmployeeAction;
  onMove?: EmployeeAction;
  onRemove?: EmployeeAction;
  onTerminate?: EmployeeAction;
  onMakeManager?: EmployeeAction;
}

export function bindEmployeeActions(
  employee: OrganizationEmployee,
  permissions: OrganizationPermissions,
  actions: EmployeeActionHandlers,
  departmentId?: Identifier,
) {
  return {
    onOpen: actions.onOpen ? () => actions.onOpen?.(employee) : undefined,
    onEditRoles:
      actions.onEditRoles && permissions.canEditEmployeeRoles(employee.id)
        ? () => actions.onEditRoles?.(employee)
        : undefined,
    onAssign:
      actions.onAssign && permissions.canAssignEmployee(employee.id) ? () => actions.onAssign?.(employee) : undefined,
    onMove: actions.onMove && permissions.canMoveEmployee(employee.id) ? () => actions.onMove?.(employee) : undefined,
    onRemove:
      actions.onRemove && permissions.canRemoveEmployee(employee.id) ? () => actions.onRemove?.(employee) : undefined,
    onTerminate:
      actions.onTerminate && permissions.canTerminateEmployee(employee.id)
        ? () => actions.onTerminate?.(employee)
        : undefined,
    onMakeManager:
      actions.onMakeManager && permissions.canAssignManager(departmentId)
        ? () => actions.onMakeManager?.(employee)
        : undefined,
  };
}
