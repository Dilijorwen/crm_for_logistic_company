/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { PasswordField } from '@nocobase/database';
import type { Plugin } from '@nocobase/server';
import { createMockServer, type ExtendedAgent, type MockServer } from '@nocobase/test';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { OrganizationStructureModule } from '../composition/OrganizationStructureModule';

const runPostgresIntegration =
  process.env.ORGANIZATION_POSTGRES_INTEGRATION === '1' && process.env.DB_DIALECT === 'postgres';

interface DepartmentModel {
  id: string | number | bigint;
  parentId: string | number | bigint | null;
  title?: string;
}

interface UserModel {
  id: string | number | bigint;
  password: string;
}

interface DepartmentUserModel {
  departmentId: string | number | bigint;
  userId: string | number | bigint;
  isOwner: boolean;
}

interface DepartmentApiRecord extends DepartmentModel {
  members?: UserModel[];
  owners?: UserModel[];
}

describe.runIf(runPostgresIntegration)('organization structure PostgreSQL integration', () => {
  let app: MockServer;
  let rootAgent: ExtendedAgent;

  beforeAll(async () => {
    if (!process.env.DB_TEST_PREFIX?.startsWith('organization_test')) {
      throw new Error(
        'Organization integration tests require an isolated DB_TEST_PREFIX beginning with organization_test.',
      );
    }
    app = await createMockServer({
      registerActions: true,
      acl: true,
      plugins: [
        'acl',
        'error-handler',
        'field-sort',
        'users',
        'ui-schema-storage',
        'data-source-main',
        'auth',
        'data-source-manager',
        'collection-tree',
        'system-settings',
        'departments',
      ],
    });
    new OrganizationStructureModule({ app, db: app.db } as unknown as Plugin).initialize();
    const rootUser = await app.db.getRepository('users').findOne();
    rootAgent = await app.agent().login(rootUser, 'root');
  });

  beforeEach(async () => {
    await app.db.getRepository('departments').destroy({ truncate: true });
  });

  afterAll(async () => {
    if (app) {
      await app.destroy();
    }
  });

  it('uses the stock departments collection and blocks a descendant move through departments:update', async () => {
    const repository = app.db.getRepository('departments');
    const root = (await repository.create({ values: { title: 'Root' } })) as unknown as DepartmentModel;
    const child = (await repository.create({
      values: { title: 'Child', parent: { id: root.id } },
    })) as unknown as DepartmentModel;

    const unauthorizedResponse = await app
      .agent()
      .resource('departments')
      .update({
        filterByTk: root.id,
        values: { parent: { id: child.id } },
      });
    expect(unauthorizedResponse.status).toBe(401);

    const response = await rootAgent.resource('departments').update({
      filterByTk: root.id,
      values: { parent: { id: child.id } },
    });

    expect(response.status).toBe(422);
    const reloaded = (await repository.findOne({ filterByTk: root.id })) as unknown as DepartmentModel;
    expect(reloaded.parentId).toBeNull();
    expect(app.db.getCollection('organization_departments')).toBeUndefined();
    expect(app.db.getCollection('employees')).toBeUndefined();
  });

  it('allows a valid move and preserves standard isLeaf maintenance', async () => {
    const repository = app.db.getRepository('departments');
    const firstRoot = (await repository.create({ values: { title: 'First root' } })) as unknown as DepartmentModel;
    const secondRoot = (await repository.create({ values: { title: 'Second root' } })) as unknown as DepartmentModel;
    const child = (await repository.create({
      values: { title: 'Child', parent: { id: firstRoot.id } },
    })) as unknown as DepartmentModel;

    const response = await rootAgent.resource('departments').update({
      filterByTk: child.id,
      values: { parent: { id: secondRoot.id } },
    });

    expect(response.status).toBe(200);
    const reloaded = (await repository.findOne({ filterByTk: child.id })) as unknown as DepartmentModel;
    expect(String(reloaded.parentId)).toBe(String(secondRoot.id));
  });

  it('uses stock CRUD and membership actions for managers and employee movement', async () => {
    const user = (await app.db.getRepository('users').create({
      values: { username: `organization-member-${Date.now()}`, nickname: 'Organization member' },
    })) as unknown as UserModel;
    const createResponse = await rootAgent.resource('departments').create({ values: { title: 'Operations' } });
    expect(createResponse.status).toBe(200);
    const department = createResponse.body.data as unknown as DepartmentModel;

    const addResponse = await rootAgent.resource('departments.members', department.id).add({ values: [user.id] });
    expect(addResponse.status).toBe(200);
    const ownerResponse = await rootAgent.resource('departments').update({
      filterByTk: department.id,
      values: { title: 'Operations renamed', owners: [{ id: user.id }] },
    });
    expect(ownerResponse.status).toBe(200);

    const membership = (await app.db.getRepository('departmentsUsers').findOne({
      filter: { departmentId: department.id, userId: user.id },
    })) as unknown as DepartmentUserModel;
    expect(membership.isOwner).toBe(true);
    const structureResponse = await rootAgent.resource('departments').list({
      paginate: false,
      appends: ['members', 'owners'],
    });
    expect(structureResponse.status).toBe(200);
    const structure = structureResponse.body.data as unknown as DepartmentApiRecord[];
    const operations = structure.find((item) => String(item.id) === String(department.id));
    expect(operations?.members?.map((member) => String(member.id))).toContain(String(user.id));
    expect(operations?.owners?.map((owner) => String(owner.id))).toContain(String(user.id));
    const renamed = (await app.db.getRepository('departments').findOne({
      filterByTk: department.id,
    })) as unknown as DepartmentModel;
    expect(renamed.title).toBe('Operations renamed');

    const targetResponse = await rootAgent.resource('departments').create({ values: { title: 'Finance' } });
    const target = targetResponse.body.data as unknown as DepartmentModel;
    const moveEmployeeResponse = await rootAgent.resource('users.departments', user.id).set({ values: [target.id] });
    expect(moveEmployeeResponse.status).toBe(200);
    expect(
      await app.db
        .getRepository('departmentsUsers')
        .count({ filter: { departmentId: department.id, userId: user.id } }),
    ).toBe(0);
    expect(
      await app.db.getRepository('departmentsUsers').count({ filter: { departmentId: target.id, userId: user.id } }),
    ).toBe(1);

    const removeResponse = await rootAgent.resource('users.departments', user.id).remove({ values: [target.id] });
    expect(removeResponse.status).toBe(200);
    expect(
      await app.db.getRepository('departmentsUsers').count({ filter: { departmentId: target.id, userId: user.id } }),
    ).toBe(0);
    const unassignedResponse = await rootAgent.resource('users').list({
      filter: { 'departments.id': { $empty: true }, id: user.id },
    });
    expect(unassignedResponse.status).toBe(200);
    const unassignedUsers = unassignedResponse.body.data as unknown as UserModel[];
    expect(unassignedUsers.map((item) => String(item.id))).toContain(String(user.id));
  });

  it('keeps stock deletion guards and rejects invalid parent input', async () => {
    const repository = app.db.getRepository('departments');
    const root = (await repository.create({ values: { title: 'Protected root' } })) as unknown as DepartmentModel;
    const child = (await repository.create({
      values: { title: 'Protected child', parent: { id: root.id } },
    })) as unknown as DepartmentModel;

    const dependentResponse = await rootAgent.resource('departments').destroy({ filterByTk: root.id });
    expect(dependentResponse.status).toBe(400);
    const invalidParentResponse = await rootAgent.resource('departments').update({
      filterByTk: child.id,
      values: { parent: { title: 'Missing identifier' } },
    });
    expect(invalidParentResponse.status).toBe(400);

    expect((await rootAgent.resource('departments').destroy({ filterByTk: child.id })).status).toBe(200);
    expect((await rootAgent.resource('departments').destroy({ filterByTk: root.id })).status).toBe(200);
  });

  it('denies department updates to a signed-in user without an allowed role', async () => {
    const restrictedUser = await app.db.getRepository('users').create({
      values: { username: `organization-restricted-${Date.now()}` },
    });
    const restrictedAgent = await app.agent().login(restrictedUser);
    const department = (await app.db.getRepository('departments').create({
      values: { title: 'Restricted' },
    })) as unknown as DepartmentModel;

    const response = await restrictedAgent.resource('departments').update({
      filterByTk: department.id,
      values: { title: 'Forbidden change' },
    });
    expect(response.status).toBe(403);
  });

  it('enforces the password policy through the standard users API', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const weakResponse = await rootAgent.resource('users').create({
      values: {
        username: `weak-password-${suffix}`,
        nickname: 'Weak password',
        password: '1234',
      },
    });
    expect(weakResponse.status).toBe(422);

    const strongPassword = 'StrongPass1!';
    const strongResponse = await rootAgent.resource('users').create({
      values: {
        username: `strong-password-${suffix}`,
        nickname: 'Strong password',
        password: strongPassword,
      },
    });
    expect(strongResponse.status).toBe(200);
    const createdUser = strongResponse.body.data as unknown as UserModel;
    const storedUser = (await app.db
      .getRepository('users')
      .findOne({ filterByTk: createdUser.id })) as unknown as UserModel;
    const passwordField = app.db.getCollection('users').getField<PasswordField>('password');
    expect(await passwordField.verify(strongPassword, storedUser.password)).toBe(true);
  });
});
