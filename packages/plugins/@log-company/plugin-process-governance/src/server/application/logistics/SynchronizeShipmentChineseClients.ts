/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { requireShipmentChineseClients } from '../../domain/logistics/ShipmentChineseClients';
import { LogisticsError } from '../../domain/logistics/LogisticsError';
import { sameIdentifier, type EntityId } from '../../domain/shared/Identifiers';
import type { LogisticsTransaction } from './ports/LogisticsRepository';

export interface ShipmentChineseClientsRepository {
  getClientIds(shipmentId: EntityId, transaction?: LogisticsTransaction): Promise<EntityId[]>;
  setClientIds(shipmentId: EntityId, clientIds: EntityId[], transaction?: LogisticsTransaction): Promise<void>;
  setLegacyClientId(shipmentId: EntityId, clientId: EntityId, transaction?: LogisticsTransaction): Promise<void>;
}

export class SynchronizeShipmentChineseClients {
  constructor(private readonly repository: ShipmentChineseClientsRepository) {}

  async execute(input: {
    shipmentId: EntityId;
    legacyClientId: EntityId | null;
    values: Record<string, unknown>;
    transaction?: LogisticsTransaction;
  }): Promise<void> {
    const { shipmentId, transaction, values, legacyClientId } = input;
    let clientIds = await this.repository.getClientIds(shipmentId, transaction);
    const hasSelection = Object.prototype.hasOwnProperty.call(values, 'chinese_client');
    if (!hasSelection && (Object.prototype.hasOwnProperty.call(values, 'chinese_client_id') || !clientIds.length)) {
      const legacy = requireShipmentChineseClients(legacyClientId);
      await this.repository.setClientIds(shipmentId, legacy, transaction);
      clientIds = await this.repository.getClientIds(shipmentId, transaction);
    }
    requireShipmentChineseClients(clientIds);
    if (hasSelection) {
      const requested = requireShipmentChineseClients(values.chinese_client);
      if (
        requested.length !== clientIds.length ||
        requested.some((id) => !clientIds.some((actual) => sameIdentifier(actual, id)))
      ) {
        throw new LogisticsError(
          'INVALID_SHIPMENT_CLIENTS',
          'Один из китайских клиентов недоступен. Обновите выбор клиентов.',
        );
      }
    }
    const compatibleId = clientIds.find((id) => sameIdentifier(id, legacyClientId)) ?? clientIds[0];
    if (!sameIdentifier(compatibleId, legacyClientId)) {
      await this.repository.setLegacyClientId(shipmentId, compatibleId, transaction);
    }
  }
}
