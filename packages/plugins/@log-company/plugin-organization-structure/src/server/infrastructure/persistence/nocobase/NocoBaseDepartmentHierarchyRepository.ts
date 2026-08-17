/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database } from '@nocobase/database';
import type {
  DepartmentAccessScope,
  DepartmentHierarchyRepository,
} from '../../../application/ports/DepartmentHierarchyRepository';
import type { DepartmentHierarchyNode } from '../../../domain/department/DepartmentHierarchyPolicy';

interface DepartmentModelLike {
  get(attribute: string): unknown;
}

function identifier(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' ? String(value) : null;
}

export class NocoBaseDepartmentHierarchyRepository implements DepartmentHierarchyRepository {
  constructor(private readonly database: Database) {}

  async findById(departmentId: string, accessScope?: DepartmentAccessScope): Promise<DepartmentHierarchyNode | null> {
    const model = (await this.database.getRepository('departments').findOne({
      filterByTk: departmentId,
      fields: ['id', 'parentId'],
      filter: accessScope?.filter,
    })) as unknown as DepartmentModelLike | null;
    if (!model) {
      return null;
    }
    const id = identifier(model.get('id'));
    if (!id) {
      return null;
    }
    return {
      id,
      parentId: identifier(model.get('parentId')),
    };
  }
}
