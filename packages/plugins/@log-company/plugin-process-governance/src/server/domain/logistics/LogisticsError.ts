/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export type LogisticsErrorCode =
  | 'INVALID_REGISTRATION_NUMBER'
  | 'INVALID_SHIPMENT_DECIMAL'
  | 'RUN_PARENT_SELF'
  | 'RUN_PARENT_CYCLE'
  | 'SHIPMENT_LINKED_TO_RUNS'
  | 'SHIPMENT_CONTRACT_COMPANY_MISMATCH';

export class LogisticsError extends Error {
  constructor(
    readonly code: LogisticsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'LogisticsError';
  }
}
