/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Context, Next } from '@nocobase/actions';
import { DepartmentHierarchyError } from '../../domain/department/DepartmentHierarchyError';
import type { ValidateDepartmentMove } from '../../application/ValidateDepartmentMove';

const NAMESPACE = '@log-company/plugin-organization-structure';

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function identifier(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' ? String(value) : null;
}

interface ParsedParentId {
  present: boolean;
  valid: boolean;
  value: string | null;
}

function parentIdFromValues(values: Record<string, unknown>): ParsedParentId {
  if (Object.prototype.hasOwnProperty.call(values, 'parent')) {
    if (values.parent === null) {
      return { present: true, valid: true, value: null };
    }
    const value = identifier(asRecord(values.parent).id);
    return { present: true, valid: value !== null, value };
  }
  if (Object.prototype.hasOwnProperty.call(values, 'parentId')) {
    if (values.parentId === null) {
      return { present: true, valid: true, value: null };
    }
    const value = identifier(values.parentId);
    return { present: true, valid: value !== null, value };
  }
  return { present: false, valid: true, value: null };
}

const errorStatus: Record<DepartmentHierarchyError['code'], number> = {
  DEPARTMENT_NOT_FOUND: 404,
  PARENT_NOT_FOUND: 404,
  SELF_PARENT: 422,
  DESCENDANT_PARENT: 422,
  CORRUPTED_HIERARCHY: 409,
};

const errorTranslation: Record<DepartmentHierarchyError['code'], string> = {
  DEPARTMENT_NOT_FOUND: 'errors.departmentNotFound',
  PARENT_NOT_FOUND: 'errors.parentNotFound',
  SELF_PARENT: 'errors.selfParent',
  DESCENDANT_PARENT: 'errors.descendantParent',
  CORRUPTED_HIERARCHY: 'errors.corruptedHierarchy',
};

export class DepartmentMovePreAction {
  constructor(private readonly validateMove: ValidateDepartmentMove) {}

  readonly handle = async (ctx: Context, next: Next): Promise<void> => {
    const { resourceName, actionName, filterByTk, values } = ctx.action.params;
    if (resourceName !== 'departments' || actionName !== 'update') {
      await next();
      return;
    }
    const parentId = parentIdFromValues(asRecord(values));
    if (!parentId.present) {
      await next();
      return;
    }
    if (!parentId.valid) {
      ctx.throw(400, ctx.t('errors.invalidParentId', { ns: NAMESPACE }));
      return;
    }
    const departmentId = identifier(filterByTk);
    if (!departmentId) {
      ctx.throw(400, ctx.t('errors.invalidDepartmentId', { ns: NAMESPACE }));
      return;
    }
    try {
      await this.validateMove.execute({
        departmentId,
        newParentId: parentId.value,
        accessScope: { filter: asRecord(ctx.action.params.filter) },
      });
    } catch (error) {
      if (error instanceof DepartmentHierarchyError) {
        ctx.throw(errorStatus[error.code], ctx.t(errorTranslation[error.code], { ns: NAMESPACE }));
        return;
      }
      throw error;
    }
    await next();
  };
}
