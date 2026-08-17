/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import { ValidateDepartmentMove } from '../application/ValidateDepartmentMove';
import { DepartmentHierarchyPolicy } from '../domain/department/DepartmentHierarchyPolicy';
import { NocoBaseDepartmentHierarchyRepository } from '../infrastructure/persistence/nocobase/NocoBaseDepartmentHierarchyRepository';
import { DepartmentMovePreAction } from '../interfaces/http/DepartmentMovePreAction';
import { PasswordPolicyPreAction } from '../interfaces/http/PasswordPolicyPreAction';

export class OrganizationStructureModule {
  constructor(private readonly plugin: Plugin) {}

  initialize(): void {
    const repository = new NocoBaseDepartmentHierarchyRepository(this.plugin.db);
    const validateMove = new ValidateDepartmentMove(repository, new DepartmentHierarchyPolicy());
    const preAction = new DepartmentMovePreAction(validateMove);
    this.plugin.app.resourceManager.use(preAction.handle, {
      tag: 'log-company.validate-department-move',
      after: 'acl',
    });
    const passwordPolicyPreAction = new PasswordPolicyPreAction();
    this.plugin.app.resourceManager.use(passwordPolicyPreAction.handle, {
      tag: 'log-company.enforce-password-policy',
      after: 'acl',
    });
  }
}
