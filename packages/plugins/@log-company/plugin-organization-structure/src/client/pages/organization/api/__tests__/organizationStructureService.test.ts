/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { APIClient } from '@nocobase/client';
import { describe, expect, it } from 'vitest';
import { OrganizationStructureService, normalizeDepartment, normalizeEmployee } from '../organizationStructureService';

interface ApiCall {
  resourceName: string;
  resourceId?: string;
  action: string;
  options: Record<string, unknown>;
}

interface RequestCall {
  method?: string;
  url?: string;
  data?: unknown;
  headers?: unknown;
}

class FakeApiClient {
  readonly calls: ApiCall[] = [];
  readonly requests: RequestCall[] = [];

  constructor(
    private readonly responses: unknown[] = [],
    private readonly requestResponses: unknown[] = [],
  ) {}

  private async invoke(
    resourceName: string,
    resourceId: string | undefined,
    action: string,
    options: Record<string, unknown>,
  ): Promise<unknown> {
    this.calls.push({ resourceName, resourceId, action, options });
    const response = this.responses.shift();
    if (response instanceof Error) {
      throw response;
    }
    return response ?? { data: { data: [] } };
  }

  resource(resourceName: string, resourceId?: string) {
    return {
      list: (options: Record<string, unknown>) => this.invoke(resourceName, resourceId, 'list', options),
      create: (options: Record<string, unknown>) => this.invoke(resourceName, resourceId, 'create', options),
      update: (options: Record<string, unknown>) => this.invoke(resourceName, resourceId, 'update', options),
      destroy: (options: Record<string, unknown>) => this.invoke(resourceName, resourceId, 'destroy', options),
      add: (options: Record<string, unknown>) => this.invoke(resourceName, resourceId, 'add', options),
      set: (options: Record<string, unknown>) => this.invoke(resourceName, resourceId, 'set', options),
      remove: (options: Record<string, unknown>) => this.invoke(resourceName, resourceId, 'remove', options),
    };
  }

  async request(options: RequestCall): Promise<unknown> {
    this.requests.push(options);
    const response = this.requestResponses.shift();
    if (response instanceof Error) {
      throw response;
    }
    return response ?? { data: { data: null } };
  }
}

describe('organization structure DTO normalization', () => {
  it('normalizes snowflake identifiers and optional employee fields without any casts', () => {
    expect(
      normalizeEmployee({
        id: 9007199254740991n,
        nickname: 'Anna Manager',
        username: 'anna',
        email: 'anna@example.test',
        departments: [{ id: 10, title: 'Operations' }],
        roles: [{ name: 'manager', title: 'Manager' }],
      }),
    ).toMatchObject({
      id: '9007199254740991',
      nickname: 'Anna Manager',
      mainDepartmentId: null,
      roles: [{ name: 'manager', title: 'Manager' }],
      departments: [{ id: '10', title: 'Operations' }],
    });
  });

  it('attaches the containing department to appended members when NocoBase omits reverse appends', () => {
    const result = normalizeDepartment({
      id: 10,
      title: 'Operations',
      parentId: null,
      members: [{ id: 2, nickname: 'Member' }],
      owners: [],
    });
    expect(result.members[0]).toMatchObject({
      mainDepartmentId: '10',
      departments: [{ id: '10', title: 'Operations' }],
    });
  });

  it('handles empty departments and absent managers', () => {
    expect(normalizeDepartment({ id: 11, title: 'Empty department' })).toMatchObject({
      members: [],
      owners: [],
      parentId: null,
    });
  });

  it('uses server pagination, search filters, and the stock unassigned relation filter', async () => {
    const api = new FakeApiClient([
      {
        data: {
          data: [{ id: 7, nickname: 'Searched user', email: 'searched@example.test', departments: [] }],
          meta: { page: 2, pageSize: 30, count: 31, totalPage: 2 },
        },
      },
    ]);
    const service = new OrganizationStructureService(api as unknown as APIClient);

    const result = await service.getEmployees({ search: 'Searched', filter: 'unassigned', page: 2, pageSize: 30 });

    expect(result).toMatchObject({ page: 2, pageSize: 30, total: 31, totalPages: 2 });
    expect(api.calls[0]).toMatchObject({
      resourceName: 'users',
      action: 'list',
      options: {
        appends: ['departments', 'roles'],
        page: 2,
        pageSize: 30,
        filter: {
          $and: [
            {
              $or: [
                { nickname: { $includes: 'Searched' } },
                { username: { $includes: 'Searched' } },
                { email: { $includes: 'Searched' } },
              ],
            },
            { 'departments.id': { $empty: true } },
          ],
        },
      },
    });
  });

  it('composes manager assignment only from stock membership and department update actions', async () => {
    const api = new FakeApiClient();
    const service = new OrganizationStructureService(api as unknown as APIClient);

    await service.assignManager('department-1', 'user-1');

    expect(api.calls).toEqual([
      {
        resourceName: 'departments.members',
        resourceId: 'department-1',
        action: 'add',
        options: { values: ['user-1'] },
      },
      {
        resourceName: 'departments',
        resourceId: undefined,
        action: 'update',
        options: { filterByTk: 'department-1', values: { owners: [{ id: 'user-1' }] } },
      },
    ]);
  });

  it('deletes an employee through the stock users destroy action', async () => {
    const api = new FakeApiClient();
    const service = new OrganizationStructureService(api as unknown as APIClient);

    await service.terminateEmployee('user-1');

    expect(api.calls).toEqual([
      {
        resourceName: 'users',
        resourceId: undefined,
        action: 'destroy',
        options: { filterByTk: 'user-1' },
      },
    ]);
  });

  it('creates a user through the stock resource with a strong ten-character password and queues setup email', async () => {
    const api = new FakeApiClient([
      {
        data: {
          data: {
            id: 8,
            nickname: 'New Employee',
            username: 'new.employee',
            email: 'new.employee@example.test',
          },
        },
      },
    ]);
    const service = new OrganizationStructureService(api as unknown as APIClient);

    const result = await service.createEmployee(
      {
        nickname: ' New Employee ',
        username: ' new.employee ',
        email: ' new.employee@example.test ',
      },
      'https://crm.example.test',
    );

    expect(result).toMatchObject({
      employee: { id: '8', nickname: 'New Employee', username: 'new.employee' },
      passwordSetupEmailQueued: true,
    });
    const values = api.calls[0].options.values as Record<string, unknown>;
    expect(values).toMatchObject({
      nickname: 'New Employee',
      username: 'new.employee',
      email: 'new.employee@example.test',
    });
    expect(values.password).toEqual(expect.any(String));
    expect(String(values.password)).toHaveLength(10);
    expect(String(values.password)).toMatch(/[A-Z]/);
    expect(String(values.password)).toMatch(/[a-z]/);
    expect(String(values.password)).toMatch(/[0-9]/);
    expect(String(values.password)).toMatch(/[!#$%^&*\-_+=]/);
    expect(api.requests).toEqual([
      {
        method: 'post',
        url: 'auth:lostPassword',
        data: { email: 'new.employee@example.test', baseURL: 'https://crm.example.test' },
        headers: { 'X-Authenticator': 'basic' },
      },
    ]);
  });

  it('returns a partial-success status when NocoBase cannot queue the password setup email', async () => {
    const api = new FakeApiClient(
      [
        {
          data: {
            data: {
              id: 9,
              nickname: 'Created Employee',
              username: 'created.employee',
              email: 'created.employee@example.test',
            },
          },
        },
      ],
      [new Error('notification channel unavailable')],
    );
    const service = new OrganizationStructureService(api as unknown as APIClient);

    const result = await service.createEmployee(
      {
        nickname: 'Created Employee',
        username: 'created.employee',
        email: 'created.employee@example.test',
      },
      'https://crm.example.test',
    );

    expect(result.passwordSetupEmailQueued).toBe(false);
    expect(result.employee.id).toBe('9');
  });

  it('does not request a password setup email when user creation fails', async () => {
    const api = new FakeApiClient([new Error('username already exists')]);
    const service = new OrganizationStructureService(api as unknown as APIClient);

    await expect(
      service.createEmployee(
        {
          nickname: 'Duplicate Employee',
          username: 'duplicate',
          email: 'duplicate@example.test',
        },
        'https://crm.example.test',
      ),
    ).rejects.toThrow('username already exists');
    expect(api.requests).toHaveLength(0);
  });

  it('propagates API errors so the shared state can refresh and display them', async () => {
    const api = new FakeApiClient([new Error('network failure')]);
    const service = new OrganizationStructureService(api as unknown as APIClient);

    await expect(service.getStructure()).rejects.toThrow('network failure');
  });
});
