/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { canSetProcessStatus, hasProcessStatusWriteRole } from '../../shared/processStatusPermissions';

export interface ProcessStatusOption {
  value?: string | number | null;
  disabled?: boolean;
  [key: string]: unknown;
}

export function isProcessStatusOption(value: unknown): value is ProcessStatusOption {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const optionValue = (value as { value?: unknown }).value;
  return (
    optionValue === undefined ||
    optionValue === null ||
    typeof optionValue === 'string' ||
    typeof optionValue === 'number'
  );
}

export function restrictProcessStatusOptions<Option extends ProcessStatusOption>(
  options: readonly Option[],
  roleNames: readonly string[],
): Option[] {
  return options.map((option) => {
    const status = typeof option.value === 'string' ? option.value : '';
    return {
      ...option,
      disabled: option.disabled === true || !canSetProcessStatus(roleNames, status),
    };
  });
}

export function isProcessStatusReadOnly(roleNames: readonly string[]): boolean {
  return !hasProcessStatusWriteRole(roleNames);
}
