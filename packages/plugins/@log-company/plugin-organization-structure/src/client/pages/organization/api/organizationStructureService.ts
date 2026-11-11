/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { APIClient } from '@nocobase/client';
import type {
  CreateEmployeeInput,
  CreateEmployeeResult,
  DepartmentMutationInput,
  DepartmentReference,
  EmployeeQuery,
  Identifier,
  OrganizationDepartment,
  OrganizationEmployee,
  PaginatedResult,
  RoleReference,
} from '../model/types';
import { asRecord, asRecordArray, responseData, responseMeta, stringValue } from './apiResponse';
import { generateInitialPassword } from '../lib/generateInitialPassword';

const DEFAULT_EMPLOYEE_PAGE_SIZE = 30;
const PASSWORD_AUTHENTICATOR = 'basic';
const BUILT_IN_ROLE_TITLES = new Map([
  ['{{t("Root")}}', 'Суперадминистратор'],
  ['{{t("Admin")}}', 'Администратор'],
  ['{{t("Member")}}', 'Участник'],
]);

function numberValue(value: unknown, fallback = 0): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function normalizeDepartmentReference(value: Record<string, unknown>): DepartmentReference {
  return {
    id: stringValue(value.id),
    title: stringValue(value.title),
  };
}

function normalizeRoleReference(value: Record<string, unknown>): RoleReference {
  const name = stringValue(value.name);
  const title = stringValue(value.title, name);
  return {
    name,
    title: BUILT_IN_ROLE_TITLES.get(title) ?? title,
  };
}

function normalizeRoles(value: unknown): RoleReference[] {
  return asRecordArray(value)
    .map(normalizeRoleReference)
    .filter((role) => role.name);
}

export function normalizeEmployee(value: Record<string, unknown>): OrganizationEmployee {
  const departments = asRecordArray(value.departments)
    .map(normalizeDepartmentReference)
    .filter((item) => item.id);
  return {
    id: stringValue(value.id),
    nickname: stringValue(value.nickname, stringValue(value.username)),
    username: stringValue(value.username),
    email: stringValue(value.email),
    phone: stringValue(value.phone) || undefined,
    position: stringValue(value.position) || stringValue(value.jobTitle) || undefined,
    avatarUrl: stringValue(value.avatar) || stringValue(value.avatarUrl) || undefined,
    isActive: typeof value.isActive === 'boolean' ? value.isActive : undefined,
    mainDepartmentId: stringValue(value.mainDepartmentId) || null,
    roles: normalizeRoles(value.roles),
    departments,
  };
}

export function normalizeDepartment(value: Record<string, unknown>): OrganizationDepartment {
  const id = stringValue(value.id);
  const title = stringValue(value.title);
  const departmentReference = id ? [{ id, title }] : [];
  const withDepartment = (employee: OrganizationEmployee): OrganizationEmployee => ({
    ...employee,
    mainDepartmentId: employee.mainDepartmentId || id || null,
    departments: employee.departments.length > 0 ? employee.departments : departmentReference,
  });
  return {
    id,
    title,
    parentId: stringValue(value.parentId) || null,
    isLeaf: value.isLeaf === true,
    sort: numberValue(value.sort),
    members: asRecordArray(value.members)
      .map(normalizeEmployee)
      .filter((item) => item.id)
      .map(withDepartment),
    owners: asRecordArray(value.owners)
      .map(normalizeEmployee)
      .filter((item) => item.id)
      .map(withDepartment),
  };
}

function employeeFilter(input: EmployeeQuery): Record<string, unknown> {
  const filters: Record<string, unknown>[] = [];
  const search = input.search.trim();
  if (search) {
    filters.push({
      $or: [{ nickname: { $includes: search } }, { username: { $includes: search } }, { email: { $includes: search } }],
    });
  }
  if (input.filter === 'unassigned') {
    filters.push({ 'departments.id': { $empty: true } });
  }
  return filters.length === 0 ? {} : filters.length === 1 ? filters[0] : { $and: filters };
}

export class OrganizationStructureService {
  constructor(private readonly api: APIClient) {}

  async getStructure(): Promise<OrganizationDepartment[]> {
    const response: unknown = await this.api.resource('departments').list({
      paginate: false,
      sort: ['sort', 'id'],
      fields: ['id', 'title', 'parentId', 'isLeaf', 'sort'],
      appends: ['members', 'members.roles', 'owners', 'owners.roles'],
    });
    return asRecordArray(responseData(response))
      .map(normalizeDepartment)
      .filter((item) => item.id);
  }

  async getEmployees(input: EmployeeQuery): Promise<PaginatedResult<OrganizationEmployee>> {
    const response: unknown = await this.api.resource('users').list({
      page: input.page,
      pageSize: input.pageSize,
      sort: ['nickname', 'id'],
      fields: ['id', 'nickname', 'username', 'email', 'phone', 'mainDepartmentId'],
      appends: ['departments', 'roles'],
      filter: employeeFilter(input),
    });
    const meta = responseMeta(response);
    return {
      items: asRecordArray(responseData(response))
        .map(normalizeEmployee)
        .filter((item) => item.id),
      page: numberValue(meta.page, input.page),
      pageSize: numberValue(meta.pageSize, input.pageSize),
      total: numberValue(meta.count),
      totalPages: numberValue(meta.totalPage, 1),
    };
  }

  async searchEmployees(search: string): Promise<OrganizationEmployee[]> {
    const result = await this.getEmployees({ search, filter: 'all', page: 1, pageSize: DEFAULT_EMPLOYEE_PAGE_SIZE });
    return result.items;
  }

  async getEmployeeRoles(employeeId: Identifier): Promise<RoleReference[]> {
    const response: unknown = await this.api.resource('users').get({
      filterByTk: employeeId,
      fields: ['id'],
      appends: ['roles'],
    });
    const user = asRecord(responseData(response));
    if (stringValue(user.id) !== employeeId || !Array.isArray(user.roles)) {
      throw new Error('Не удалось прочитать назначенные роли сотрудника.');
    }
    return normalizeRoles(user.roles);
  }

  async getAssignableRoles(): Promise<RoleReference[]> {
    const response: unknown = await this.api.resource('roles').list({
      paginate: false,
      fields: ['name', 'title', 'hidden'],
      sort: ['title', 'name'],
    });
    const roles = asRecordArray(responseData(response)).filter(
      (role) => role.hidden !== true && role.name !== 'root' && role.name !== 'anonymous',
    );
    return normalizeRoles(roles);
  }

  async updateEmployeeRoles(employeeId: Identifier, roleNames: string[]): Promise<void> {
    const response: unknown = await this.api.resource('users').update({
      filterByTk: employeeId,
      values: { roles: roleNames },
    });
    if (!asRecordArray(responseData(response)).some((user) => stringValue(user.id) === employeeId)) {
      throw new Error('Сотрудник не найден или его роли недоступны для изменения.');
    }
  }

  async createEmployee(input: CreateEmployeeInput, applicationBaseUrl: string): Promise<CreateEmployeeResult> {
    const response: unknown = await this.api.resource('users').create({
      values: {
        nickname: input.nickname.trim(),
        email: input.email.trim(),
        username: input.username.trim(),
        password: generateInitialPassword(),
      },
    });
    const employee = normalizeEmployee(asRecordArray([responseData(response)])[0] || {});
    let passwordSetupEmailQueued = true;
    try {
      await this.api.request({
        method: 'post',
        url: 'auth:lostPassword',
        data: {
          email: input.email.trim(),
          baseURL: applicationBaseUrl,
        },
        headers: {
          'X-Authenticator': PASSWORD_AUTHENTICATOR,
        },
      });
    } catch {
      passwordSetupEmailQueued = false;
    }
    return { employee, passwordSetupEmailQueued };
  }

  async createDepartment(input: DepartmentMutationInput): Promise<Identifier> {
    const response: unknown = await this.api.resource('departments').create({
      values: {
        title: input.title.trim(),
        parent: input.parentId ? { id: input.parentId } : null,
      },
    });
    const created = normalizeDepartment(asRecordArray([responseData(response)])[0] || {});
    if (input.managerId && created.id) {
      await this.assignManager(created.id, input.managerId);
    }
    return created.id;
  }

  async updateDepartment(
    departmentId: Identifier,
    title: string,
    managerId: Identifier | null | undefined,
  ): Promise<void> {
    if (managerId) {
      await this.api.resource('departments.members', departmentId).add({ values: [managerId] });
    }
    const values: Record<string, unknown> = { title: title.trim() };
    if (managerId !== undefined) {
      values.owners = managerId ? [{ id: managerId }] : [];
    }
    await this.api.resource('departments').update({ filterByTk: departmentId, values });
  }

  async moveDepartment(departmentId: Identifier, parentId: Identifier | null): Promise<void> {
    await this.api.resource('departments').update({
      filterByTk: departmentId,
      values: { parent: parentId ? { id: parentId } : null },
    });
  }

  async deleteDepartment(departmentId: Identifier): Promise<void> {
    await this.api.resource('departments').destroy({ filterByTk: departmentId });
  }

  async assignEmployee(employeeId: Identifier, departmentId: Identifier): Promise<void> {
    await this.api.resource('users.departments', employeeId).add({ values: [departmentId] });
  }

  async moveEmployee(employeeId: Identifier, departmentId: Identifier): Promise<void> {
    await this.api.resource('users.departments', employeeId).set({ values: [departmentId] });
  }

  async removeEmployee(employeeId: Identifier, departmentId: Identifier): Promise<void> {
    await this.api.resource('users.departments', employeeId).remove({ values: [departmentId] });
  }

  async terminateEmployee(employeeId: Identifier): Promise<void> {
    await this.api.resource('users').destroy({ filterByTk: employeeId });
  }

  async addEmployees(departmentId: Identifier, employeeIds: Identifier[]): Promise<void> {
    await this.api.resource('departments.members', departmentId).add({ values: employeeIds });
  }

  async assignManager(departmentId: Identifier, employeeId: Identifier): Promise<void> {
    await this.api.resource('departments.members', departmentId).add({ values: [employeeId] });
    await this.api.resource('departments').update({
      filterByTk: departmentId,
      values: { owners: [{ id: employeeId }] },
    });
  }

  async removeManagers(departmentId: Identifier): Promise<void> {
    await this.api.resource('departments').update({ filterByTk: departmentId, values: { owners: [] } });
  }
}
