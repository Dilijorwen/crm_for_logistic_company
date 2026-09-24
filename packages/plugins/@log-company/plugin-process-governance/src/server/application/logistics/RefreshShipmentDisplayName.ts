/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { buildShipmentDisplayName } from '../../domain/logistics/ShipmentDisplayName';
import type { EntityId } from '../../domain/shared/Identifiers';
import type { LogisticsRepository, LogisticsTransaction } from './ports/LogisticsRepository';

export class RefreshShipmentDisplayName {
  constructor(private readonly repository: LogisticsRepository) {}

  async execute(shipmentId: EntityId, transaction?: LogisticsTransaction): Promise<string | null> {
    const parts = await this.repository.getShipmentDisplayNameParts(shipmentId, transaction);
    if (!parts) {
      return null;
    }
    const displayName = buildShipmentDisplayName(parts);
    await this.repository.updateShipmentDisplayName(shipmentId, displayName, transaction);
    return displayName;
  }

  async executeForClient(clientId: EntityId, transaction?: LogisticsTransaction): Promise<void> {
    const shipmentIds = await this.repository.getShipmentIdsByClientId(clientId, transaction);
    for (const shipmentId of shipmentIds) {
      await this.execute(shipmentId, transaction);
    }
  }
}
