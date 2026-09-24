/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { assertShipmentCanBeDeleted } from '../../domain/logistics/ShipmentDeletionPolicy';
import type { EntityId } from '../../domain/shared/Identifiers';
import type { LogisticsRepository, LogisticsTransaction } from './ports/LogisticsRepository';

export class ValidateShipmentDeletion {
  constructor(private readonly repository: LogisticsRepository) {}

  async execute(shipmentId: EntityId, transaction?: LogisticsTransaction): Promise<void> {
    assertShipmentCanBeDeleted(await this.repository.countShipmentRunLinks(shipmentId, transaction));
  }
}
