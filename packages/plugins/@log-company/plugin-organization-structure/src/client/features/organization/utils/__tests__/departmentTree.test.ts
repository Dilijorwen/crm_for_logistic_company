/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import type { OrganizationDepartment } from '../../model/types';
import {
  buildDepartmentTree,
  collectDepartmentIds,
  filterDepartmentTree,
  getAncestorIds,
  getDescendantIds,
} from '../departmentTree';

function department(id: string, parentId: string | null, title: string, sort = 0): OrganizationDepartment {
  return { id, parentId, title, sort, isLeaf: true, members: [], owners: [] };
}

const departments = [
  department('1', null, 'Leadership'),
  department('2', '1', 'Operations', 2),
  department('3', '1', 'Finance', 1),
  department('4', '2', 'Customs'),
  department('5', null, 'Regional office'),
];

describe('department tree', () => {
  it('builds multiple sorted roots without a virtual parent', () => {
    const tree = buildDepartmentTree(departments);
    expect(tree.map((node) => node.title)).toEqual(['Leadership', 'Regional office']);
    expect(tree[0].children.map((node) => node.title)).toEqual(['Finance', 'Operations']);
  });

  it('returns ancestors and descendants used by focus and move guards', () => {
    expect(getAncestorIds(departments, '4')).toEqual(['2', '1']);
    expect([...getDescendantIds(departments, '1')]).toEqual(['2', '3', '4']);
  });

  it('keeps matching descendants and their real ancestors during search', () => {
    const filtered = filterDepartmentTree(buildDepartmentTree(departments), 'customs');
    expect(collectDepartmentIds(filtered)).toEqual(['1', '2', '4']);
  });
});
