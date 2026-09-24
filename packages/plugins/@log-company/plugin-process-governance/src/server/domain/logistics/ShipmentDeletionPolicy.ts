/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { LogisticsError } from './LogisticsError';

export function assertShipmentCanBeDeleted(linkedRunCount: number): void {
  if (linkedRunCount > 0) {
    throw new LogisticsError(
      'SHIPMENT_LINKED_TO_RUNS',
      'Нельзя удалить поставку, пока она связана с рейсами. Удалите связанные рейсы или уберите поставку из них.',
    );
  }
}
