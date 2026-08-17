/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export type Identifier = string;

export interface DepartmentReference {
  id: Identifier;
  title: string;
}

export interface RoleReference {
  name: string;
  title: string;
}

export interface OrganizationEmployee {
  id: Identifier;
  nickname: string;
  username: string;
  email: string;
  phone?: string;
  position?: string;
  avatarUrl?: string;
  isActive?: boolean;
  mainDepartmentId: Identifier | null;
  roles: RoleReference[];
  departments: DepartmentReference[];
}

export interface OrganizationDepartment {
  id: Identifier;
  title: string;
  parentId: Identifier | null;
  isLeaf: boolean;
  sort: number;
  members: OrganizationEmployee[];
  owners: OrganizationEmployee[];
}

export interface DepartmentTreeNode extends OrganizationDepartment {
  children: DepartmentTreeNode[];
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type EmployeeFilter = 'all' | 'unassigned';

export interface EmployeeQuery {
  search: string;
  filter: EmployeeFilter;
  page: number;
  pageSize: number;
}

export interface DepartmentMutationInput {
  title: string;
  parentId: Identifier | null;
  managerId: Identifier | null;
}

export interface CreateEmployeeInput {
  nickname: string;
  email: string;
  username: string;
}

export interface CreateEmployeeResult {
  employee: OrganizationEmployee;
  passwordSetupEmailQueued: boolean;
}

export interface OrganizationPermissions {
  canViewDepartments: boolean;
  canViewUsers: boolean;
  canCreateEmployee: boolean;
  canCreateDepartment: (parentId: Identifier | null) => boolean;
  canUpdateDepartment: (departmentId: Identifier) => boolean;
  canMoveDepartment: (departmentId: Identifier) => boolean;
  canDeleteDepartment: (departmentId: Identifier) => boolean;
  canAssignEmployee: (employeeId: Identifier) => boolean;
  canMoveEmployee: (employeeId: Identifier) => boolean;
  canRemoveEmployee: (employeeId: Identifier) => boolean;
  canTerminateEmployee: (employeeId: Identifier) => boolean;
  canAddMembers: (departmentId: Identifier) => boolean;
  canAssignManager: (departmentId?: Identifier) => boolean;
}

export interface FocusTarget {
  departmentId: Identifier;
  employeeId?: Identifier;
  revision: number;
}
