/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export type DepartmentHierarchyErrorCode =
  | 'DEPARTMENT_NOT_FOUND'
  | 'PARENT_NOT_FOUND'
  | 'SELF_PARENT'
  | 'DESCENDANT_PARENT'
  | 'CORRUPTED_HIERARCHY';

export class DepartmentHierarchyError extends Error {
  constructor(
    public readonly code: DepartmentHierarchyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DepartmentHierarchyError';
  }
}
