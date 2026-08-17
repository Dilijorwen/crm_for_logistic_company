/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { DepartmentHierarchyError } from '../../domain/department/DepartmentHierarchyError';
import {
  DepartmentHierarchyPolicy,
  type DepartmentHierarchyNode,
} from '../../domain/department/DepartmentHierarchyPolicy';
import { ValidateDepartmentMove } from '../ValidateDepartmentMove';
import type { DepartmentHierarchyRepository } from '../ports/DepartmentHierarchyRepository';

function repository(nodes: DepartmentHierarchyNode[]): DepartmentHierarchyRepository {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return { findById: async (departmentId) => byId.get(departmentId) || null };
}

describe('ValidateDepartmentMove', () => {
  it('allows moving to a separate branch and to the root', async () => {
    const action = new ValidateDepartmentMove(
      repository([
        { id: '1', parentId: null },
        { id: '2', parentId: '1' },
        { id: '3', parentId: null },
      ]),
      new DepartmentHierarchyPolicy(),
    );
    await expect(action.execute({ departmentId: '2', newParentId: '3' })).resolves.toBeUndefined();
    await expect(action.execute({ departmentId: '2', newParentId: null })).resolves.toBeUndefined();
  });

  it('rejects a missing source or target', async () => {
    const action = new ValidateDepartmentMove(
      repository([{ id: '1', parentId: null }]),
      new DepartmentHierarchyPolicy(),
    );
    await expect(action.execute({ departmentId: '9', newParentId: null })).rejects.toMatchObject({
      code: 'DEPARTMENT_NOT_FOUND',
    });
    await expect(action.execute({ departmentId: '1', newParentId: '9' })).rejects.toMatchObject({
      code: 'PARENT_NOT_FOUND',
    });
  });

  it('rejects moving a parent into its descendant', async () => {
    const action = new ValidateDepartmentMove(
      repository([
        { id: '1', parentId: null },
        { id: '2', parentId: '1' },
      ]),
      new DepartmentHierarchyPolicy(),
    );
    await expect(action.execute({ departmentId: '1', newParentId: '2' })).rejects.toBeInstanceOf(
      DepartmentHierarchyError,
    );
  });
});
