/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { BelongsToManyRepository, Database, Model, Transaction } from '@nocobase/database';
import type { ShipmentChineseClientsRepository } from '../../../application/logistics/SynchronizeShipmentChineseClients';
import type { LogisticsTransaction } from '../../../application/logistics/ports/LogisticsRepository';
import { normalizeIdentifiers, type EntityId } from '../../../domain/shared/Identifiers';

export class NocoBaseShipmentChineseClientsRepository implements ShipmentChineseClientsRepository {
  constructor(private readonly db: Database) {}

  async getClientIds(shipmentId: EntityId, transaction?: LogisticsTransaction): Promise<EntityId[]> {
    const rows: Model[] = await this.db.getRepository('shipment_chinese_clients').find({
      filter: { shipment_id: shipmentId },
      sort: ['chinese_client_id'],
      transaction: transaction as Transaction,
    });
    return normalizeIdentifiers(rows.map((row) => row.get('chinese_client_id')));
  }

  async setClientIds(shipmentId: EntityId, clientIds: EntityId[], transaction?: LogisticsTransaction): Promise<void> {
    await this.db
      .getRepository<BelongsToManyRepository>('shipments.chinese_client', String(shipmentId))
      .set({ tk: clientIds, transaction: transaction as Transaction });
  }

  async setLegacyClientId(shipmentId: EntityId, clientId: EntityId, transaction?: LogisticsTransaction): Promise<void> {
    await this.db.getCollection('shipments').model.update(
      { chinese_client_id: clientId },
      {
        where: { id: shipmentId },
        transaction: transaction as Transaction,
        hooks: false,
        silent: true,
      },
    );
  }
}
