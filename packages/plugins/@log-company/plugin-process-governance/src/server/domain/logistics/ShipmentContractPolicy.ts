/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { LogisticsError } from './LogisticsError';

export function assertShipmentContractBelongsToCompany(isLinked: boolean): void {
  if (!isLinked) {
    throw new LogisticsError(
      'SHIPMENT_CONTRACT_COMPANY_MISMATCH',
      'Выбранный контракт не привязан к указанной компании.',
    );
  }
}
