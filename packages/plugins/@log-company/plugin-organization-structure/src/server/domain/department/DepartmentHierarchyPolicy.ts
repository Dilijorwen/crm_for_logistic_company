/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DepartmentHierarchyError } from './DepartmentHierarchyError';

export interface DepartmentHierarchyNode {
  id: string;
  parentId: string | null;
}

export class DepartmentHierarchyPolicy {
  assertCanMove(departmentId: string, parentChain: DepartmentHierarchyNode[]): void {
    if (parentChain.length > 0 && parentChain[0].id === departmentId) {
      throw new DepartmentHierarchyError('SELF_PARENT', 'A department cannot be its own parent.');
    }
    if (parentChain.some((department) => department.id === departmentId)) {
      throw new DepartmentHierarchyError(
        'DESCENDANT_PARENT',
        'A department cannot be moved into one of its descendants.',
      );
    }
    const uniqueIds = new Set(parentChain.map((department) => department.id));
    if (uniqueIds.size !== parentChain.length) {
      throw new DepartmentHierarchyError('CORRUPTED_HIERARCHY', 'The existing department hierarchy contains a cycle.');
    }
  }
}
