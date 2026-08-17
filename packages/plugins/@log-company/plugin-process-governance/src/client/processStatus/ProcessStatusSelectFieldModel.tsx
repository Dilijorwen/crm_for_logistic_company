/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { SelectFieldModel } from '@nocobase/client';
import React from 'react';
import { resolveProcessStatusRoleNames } from '../../shared/processStatusPermissions';
import {
  isProcessStatusOption,
  isProcessStatusReadOnly,
  type ProcessStatusOption,
  restrictProcessStatusOptions,
} from './processStatusOptions';

const PROCESS_COLLECTION = 'customs_processes';
const PROCESS_STATUS_FIELD = 'status';

interface CurrentUserRole {
  name?: unknown;
}

interface GovernedSelectElementProps {
  allowClear?: boolean | object;
  disabled?: boolean;
  options?: ProcessStatusOption[];
}

function getAssignedRoleNames(roles: unknown): string[] {
  if (!Array.isArray(roles)) {
    return [];
  }
  return roles
    .map((role: CurrentUserRole) => role.name)
    .filter((roleName): roleName is string => typeof roleName === 'string' && roleName.length > 0);
}

export class ProcessStatusSelectFieldModel extends SelectFieldModel {
  render() {
    const rendered = super.render();
    const collectionField = this.context.collectionField;
    if (
      collectionField?.collectionName !== PROCESS_COLLECTION ||
      collectionField?.name !== PROCESS_STATUS_FIELD ||
      !React.isValidElement<GovernedSelectElementProps>(rendered)
    ) {
      return rendered;
    }

    const roleNames = resolveProcessStatusRoleNames(
      this.context.api?.auth?.role,
      getAssignedRoleNames(this.context.user?.roles),
    );
    const options = Array.isArray(rendered.props.options)
      ? restrictProcessStatusOptions(rendered.props.options.filter(isProcessStatusOption), roleNames)
      : rendered.props.options;

    return React.cloneElement(rendered, {
      allowClear: false,
      disabled: rendered.props.disabled || isProcessStatusReadOnly(roleNames),
      options,
    });
  }
}
