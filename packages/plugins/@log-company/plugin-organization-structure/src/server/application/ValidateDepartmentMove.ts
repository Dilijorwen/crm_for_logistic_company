/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DepartmentHierarchyError } from '../domain/department/DepartmentHierarchyError';
import { DepartmentHierarchyPolicy } from '../domain/department/DepartmentHierarchyPolicy';
import type { DepartmentAccessScope, DepartmentHierarchyRepository } from './ports/DepartmentHierarchyRepository';

export interface ValidateDepartmentMoveInput {
  departmentId: string;
  newParentId: string | null;
  accessScope?: DepartmentAccessScope;
}

export class ValidateDepartmentMove {
  constructor(
    private readonly repository: DepartmentHierarchyRepository,
    private readonly policy: DepartmentHierarchyPolicy,
  ) {}

  async execute(input: ValidateDepartmentMoveInput): Promise<void> {
    const department = await this.repository.findById(input.departmentId, input.accessScope);
    if (!department) {
      throw new DepartmentHierarchyError('DEPARTMENT_NOT_FOUND', 'Department does not exist or is unavailable.');
    }
    if (!input.newParentId) {
      return;
    }

    const parentChain = [];
    const visited = new Set<string>();
    let currentId: string | null = input.newParentId;
    while (currentId) {
      if (visited.has(currentId)) {
        parentChain.push({ id: currentId, parentId: currentId });
        break;
      }
      visited.add(currentId);
      const parent = await this.repository.findById(currentId);
      if (!parent) {
        if (currentId === input.newParentId) {
          throw new DepartmentHierarchyError('PARENT_NOT_FOUND', 'Parent department does not exist.');
        }
        break;
      }
      parentChain.push(parent);
      currentId = parent.parentId;
    }
    this.policy.assertCanMove(input.departmentId, parentChain);
  }
}
