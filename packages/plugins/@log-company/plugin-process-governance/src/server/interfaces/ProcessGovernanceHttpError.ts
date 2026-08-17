/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { type ProcessGovernanceErrorCode, ProcessGovernanceError } from '../domain/process/ProcessGovernanceError';

const NAMESPACE = '@log-company/plugin-process-governance';

interface RoleState {
  currentRole?: unknown;
  currentRoles?: unknown;
}

interface TranslatableContext {
  state?: RoleState;
  t?: (key: string, options: { ns: string }) => string;
}

const translations: Partial<Record<ProcessGovernanceErrorCode, { key: string; fallback: string }>> = {
  PROCESS_STATUS_INVALID: {
    key: 'errors.invalidProcessStatus',
    fallback: 'Указан недопустимый статус таможенного процесса.',
  },
  PROCESS_STATUS_FORBIDDEN: {
    key: 'errors.processStatusForbidden',
    fallback: 'У текущей роли нет права устанавливать этот статус таможенного процесса.',
  },
};

export function extractProcessRoleNames(context: unknown): string[] | null {
  if (context === null || typeof context !== 'object' || Array.isArray(context)) {
    return null;
  }
  const state = (context as TranslatableContext).state;
  if (!state) {
    return null;
  }

  const roleNames = Array.isArray(state.currentRoles)
    ? state.currentRoles.filter((roleName): roleName is string => typeof roleName === 'string' && Boolean(roleName))
    : [];
  if (typeof state.currentRole === 'string' && state.currentRole && state.currentRole !== '__union__') {
    roleNames.push(state.currentRole);
  }
  return [...new Set(roleNames)];
}

export function processGovernanceErrorStatus(error: ProcessGovernanceError): number {
  if (error.code === 'PROCESS_STATUS_FORBIDDEN') {
    return 403;
  }
  if (error.code === 'PROCESS_STATUS_INVALID') {
    return 422;
  }
  return 400;
}

export function processGovernanceErrorMessage(context: unknown, error: ProcessGovernanceError): string {
  const translation = translations[error.code];
  if (!translation) {
    return error.message;
  }
  if (context !== null && typeof context === 'object' && !Array.isArray(context)) {
    const translate = (context as TranslatableContext).t;
    if (translate) {
      return translate.call(context, translation.key, { ns: NAMESPACE });
    }
  }
  return translation.fallback;
}
