/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import type { OrganizationDepartment, OrganizationEmployee } from '../../model/types';
import { buildDepartmentMemberPreview, VISIBLE_DEPARTMENT_MEMBER_COUNT } from '../departmentMembers';

function employee(id: string): OrganizationEmployee {
  return {
    id,
    nickname: `Employee ${id}`,
    username: `employee-${id}`,
    email: '',
    mainDepartmentId: 'department-1',
    roles: [],
    departments: [{ id: 'department-1', title: 'Department' }],
  };
}

function department(members: OrganizationEmployee[], owners: OrganizationEmployee[]): OrganizationDepartment {
  return {
    id: 'department-1',
    title: 'Department',
    parentId: null,
    isLeaf: true,
    sort: 0,
    members,
    owners,
  };
}

describe('department member preview', () => {
  it('keeps managers in their dedicated block and limits the regular member preview', () => {
    const members = Array.from({ length: 9 }, (_, index) => employee(String(index + 1)));
    const preview = buildDepartmentMemberPreview(department(members, [members[0]]));

    expect(preview.visibleMembers).toHaveLength(VISIBLE_DEPARTMENT_MEMBER_COUNT);
    expect(preview.visibleMembers.map((item) => item.id)).not.toContain(members[0].id);
    expect(preview.hiddenMemberCount).toBe(2);
  });

  it('handles an empty department without hidden members', () => {
    expect(buildDepartmentMemberPreview(department([], []))).toEqual({ visibleMembers: [], hiddenMemberCount: 0 });
  });
});
