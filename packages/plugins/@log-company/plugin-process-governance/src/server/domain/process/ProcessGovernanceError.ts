/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export type ProcessGovernanceErrorCode =
  | 'PROCESS_PARENT_SELF'
  | 'PROCESS_PARENT_CYCLE'
  | 'PROCESS_STATUS_INVALID'
  | 'PROCESS_STATUS_FORBIDDEN';

export class ProcessGovernanceError extends Error {
  constructor(
    readonly code: ProcessGovernanceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ProcessGovernanceError';
  }
}
