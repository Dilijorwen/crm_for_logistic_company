/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { OrganizationDepartment, OrganizationEmployee } from '../model/types';

export const VISIBLE_DEPARTMENT_MEMBER_COUNT = 6;

export interface DepartmentMemberPreview {
  visibleMembers: OrganizationEmployee[];
  hiddenMemberCount: number;
}

export function buildDepartmentMemberPreview(department: OrganizationDepartment): DepartmentMemberPreview {
  const ownerIds = new Set(department.owners.map((owner) => owner.id));
  const regularMembers = department.members.filter((member) => !ownerIds.has(member.id));
  const visibleMembers = regularMembers.slice(0, VISIBLE_DEPARTMENT_MEMBER_COUNT);
  return {
    visibleMembers,
    hiddenMemberCount: Math.max(0, regularMembers.length - visibleMembers.length),
  };
}
