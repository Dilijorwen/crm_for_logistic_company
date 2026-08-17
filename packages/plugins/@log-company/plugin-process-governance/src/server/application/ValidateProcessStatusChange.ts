/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { assertProcessStatusChangeAllowed } from '../domain/process/ProcessStatusPolicy';
import type { ProcessGovernanceRepository } from './ports/ProcessGovernanceRepository';

export interface ValidateProcessStatusChangeInput {
  roleNames: readonly string[];
  currentStatus: unknown;
  requestedStatus: unknown;
  isExistingProcess: boolean;
}

export class ValidateProcessStatusChange {
  constructor(private readonly repository: ProcessGovernanceRepository) {}

  execute(input: ValidateProcessStatusChangeInput): void {
    assertProcessStatusChangeAllowed({
      ...input,
      knownStatusValues: this.repository.getProcessStatusValues(),
    });
  }
}
