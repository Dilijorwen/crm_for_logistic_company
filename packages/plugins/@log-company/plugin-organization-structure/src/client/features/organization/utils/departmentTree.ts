/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { DepartmentTreeNode, Identifier, OrganizationDepartment } from '../model/types';

function compareDepartments(left: OrganizationDepartment, right: OrganizationDepartment): number {
  if (left.sort !== right.sort) {
    return left.sort - right.sort;
  }
  return left.title.localeCompare(right.title);
}

export function buildDepartmentTree(departments: OrganizationDepartment[]): DepartmentTreeNode[] {
  const nodes = new Map<Identifier, DepartmentTreeNode>();
  const roots: DepartmentTreeNode[] = [];

  for (const department of departments) {
    nodes.set(department.id, { ...department, children: [] });
  }

  for (const department of departments) {
    const node = nodes.get(department.id);
    if (!node) {
      continue;
    }
    const parent = department.parentId ? nodes.get(department.parentId) : undefined;
    if (parent && parent.id !== node.id) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (items: DepartmentTreeNode[]): void => {
    items.sort(compareDepartments);
    for (const item of items) {
      sortNodes(item.children);
    }
  };
  sortNodes(roots);
  return roots;
}

export function getAncestorIds(departments: OrganizationDepartment[], departmentId: Identifier): Identifier[] {
  const parentById = new Map(departments.map((department) => [department.id, department.parentId]));
  const ancestors: Identifier[] = [];
  const visited = new Set<Identifier>();
  let currentId = parentById.get(departmentId) || null;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    ancestors.push(currentId);
    currentId = parentById.get(currentId) || null;
  }
  return ancestors;
}

export function getDescendantIds(departments: OrganizationDepartment[], departmentId: Identifier): Set<Identifier> {
  const childrenByParent = new Map<Identifier, Identifier[]>();
  for (const department of departments) {
    if (!department.parentId) {
      continue;
    }
    const children = childrenByParent.get(department.parentId) || [];
    children.push(department.id);
    childrenByParent.set(department.parentId, children);
  }
  const descendants = new Set<Identifier>();
  const pending = [...(childrenByParent.get(departmentId) || [])];
  while (pending.length > 0) {
    const currentId = pending.shift();
    if (!currentId || descendants.has(currentId)) {
      continue;
    }
    descendants.add(currentId);
    pending.push(...(childrenByParent.get(currentId) || []));
  }
  return descendants;
}

export function filterDepartmentTree(nodes: DepartmentTreeNode[], query: string): DepartmentTreeNode[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return nodes;
  }
  const filterNodes = (items: DepartmentTreeNode[]): DepartmentTreeNode[] =>
    items.flatMap((item) => {
      const children = filterNodes(item.children);
      if (item.title.toLocaleLowerCase().includes(normalizedQuery) || children.length > 0) {
        return [{ ...item, children }];
      }
      return [];
    });
  return filterNodes(nodes);
}

export function collectDepartmentIds(nodes: DepartmentTreeNode[]): Identifier[] {
  return nodes.flatMap((node) => [node.id, ...collectDepartmentIds(node.children)]);
}
