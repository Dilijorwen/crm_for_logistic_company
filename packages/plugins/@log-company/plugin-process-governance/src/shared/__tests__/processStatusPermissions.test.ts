/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import {
  canSetProcessStatus,
  hasProcessStatusWriteRole,
  PROCESS_STATUS_ROLE_NAMES,
  resolveProcessStatusRoleNames,
  UNION_ROLE_NAME,
} from '../processStatusPermissions';

describe('processStatusPermissions', () => {
  it.each([PROCESS_STATUS_ROLE_NAMES.manager, PROCESS_STATUS_ROLE_NAMES.managerIntern])(
    'gives manager role %s access to manager statuses and the shared Russia status',
    (roleName) => {
      expect(canSetProcessStatus([roleName], 'queue')).toBe(true);
      expect(canSetProcessStatus([roleName], 'in_work')).toBe(true);
      expect(canSetProcessStatus([roleName], 'knr')).toBe(true);
      expect(canSetProcessStatus([roleName], 'in_russia')).toBe(true);
      expect(canSetProcessStatus([roleName], 'warehouse')).toBe(false);
    },
  );

  it.each([PROCESS_STATUS_ROLE_NAMES.declarant, PROCESS_STATUS_ROLE_NAMES.declarantIntern])(
    'gives declarant role %s access to Russia and all non-manager statuses',
    (roleName) => {
      expect(canSetProcessStatus([roleName], 'in_russia')).toBe(true);
      expect(canSetProcessStatus([roleName], 'warehouse')).toBe(true);
      expect(canSetProcessStatus([roleName], 'release')).toBe(true);
      expect(canSetProcessStatus([roleName], 'queue')).toBe(false);
      expect(canSetProcessStatus([roleName], 'in_work')).toBe(false);
      expect(canSetProcessStatus([roleName], 'knr')).toBe(false);
    },
  );

  it('keeps every other role read-only', () => {
    expect(hasProcessStatusWriteRole(['accountant'])).toBe(false);
    expect(hasProcessStatusWriteRole(['root'])).toBe(false);
    expect(canSetProcessStatus(['accountant'], 'in_russia')).toBe(false);
    expect(canSetProcessStatus(['root'], 'queue')).toBe(false);
  });

  it('combines permissions when NocoBase union-role mode supplies both role groups', () => {
    const roles = [PROCESS_STATUS_ROLE_NAMES.manager, PROCESS_STATUS_ROLE_NAMES.declarant];
    expect(canSetProcessStatus(roles, 'queue')).toBe(true);
    expect(canSetProcessStatus(roles, 'warehouse')).toBe(true);
  });

  it('uses only the active role unless NocoBase union-role mode is selected', () => {
    const assignedRoles = [PROCESS_STATUS_ROLE_NAMES.manager, PROCESS_STATUS_ROLE_NAMES.declarant];
    expect(resolveProcessStatusRoleNames(PROCESS_STATUS_ROLE_NAMES.manager, assignedRoles)).toEqual([
      PROCESS_STATUS_ROLE_NAMES.manager,
    ]);
    expect(resolveProcessStatusRoleNames(UNION_ROLE_NAME, assignedRoles)).toEqual(assignedRoles);
    expect(resolveProcessStatusRoleNames(undefined, assignedRoles)).toEqual([]);
  });
});
