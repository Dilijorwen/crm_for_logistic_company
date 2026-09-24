/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { LogisticsError } from '../../domain/logistics/LogisticsError';

export function logisticsErrorStatus(error: LogisticsError): number {
  if (error.code === 'SHIPMENT_LINKED_TO_RUNS') {
    return 409;
  }
  if (error.code === 'INVALID_REGISTRATION_NUMBER' || error.code === 'INVALID_SHIPMENT_DECIMAL') {
    return 422;
  }
  return 400;
}

export function asLogisticsHttpError(error: LogisticsError): Error {
  const status = logisticsErrorStatus(error);
  return Object.assign(new Error(error.message), { status, statusCode: status });
}
