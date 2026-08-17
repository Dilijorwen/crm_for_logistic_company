/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { DepartmentHierarchyError } from '../DepartmentHierarchyError';
import { DepartmentHierarchyPolicy } from '../DepartmentHierarchyPolicy';

describe('DepartmentHierarchyPolicy', () => {
  const policy = new DepartmentHierarchyPolicy();

  it('accepts an unrelated parent chain', () => {
    expect(() =>
      policy.assertCanMove('10', [
        { id: '2', parentId: '1' },
        { id: '1', parentId: null },
      ]),
    ).not.toThrow();
  });

  it('rejects the department itself and its descendants as parents', () => {
    expect(() => policy.assertCanMove('10', [{ id: '10', parentId: '2' }])).toThrow(DepartmentHierarchyError);
    expect(() =>
      policy.assertCanMove('10', [
        { id: '20', parentId: '10' },
        { id: '10', parentId: null },
      ]),
    ).toThrowError(/descendants/);
  });

  it('rejects an already corrupted parent chain', () => {
    expect(() =>
      policy.assertCanMove('10', [
        { id: '2', parentId: '1' },
        { id: '1', parentId: '2' },
        { id: '2', parentId: '1' },
      ]),
    ).toThrowError(/contains a cycle/);
  });
});
