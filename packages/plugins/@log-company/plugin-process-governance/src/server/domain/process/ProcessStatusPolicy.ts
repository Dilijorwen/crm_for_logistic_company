/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { canSetProcessStatus } from '../../../shared/processStatusPermissions';
import { ProcessGovernanceError } from './ProcessGovernanceError';

export interface ProcessStatusChange {
  roleNames: readonly string[];
  currentStatus: unknown;
  requestedStatus: unknown;
  isExistingProcess: boolean;
  knownStatusValues: readonly string[];
}

export function assertProcessStatusChangeAllowed(change: ProcessStatusChange): void {
  if (change.isExistingProcess && change.currentStatus === change.requestedStatus) {
    return;
  }

  if (
    typeof change.requestedStatus !== 'string' ||
    !change.requestedStatus ||
    !change.knownStatusValues.includes(change.requestedStatus)
  ) {
    throw new ProcessGovernanceError('PROCESS_STATUS_INVALID', 'Invalid customs process status.');
  }

  if (!canSetProcessStatus(change.roleNames, change.requestedStatus)) {
    throw new ProcessGovernanceError('PROCESS_STATUS_FORBIDDEN', 'The role cannot set this customs process status.');
  }
}
