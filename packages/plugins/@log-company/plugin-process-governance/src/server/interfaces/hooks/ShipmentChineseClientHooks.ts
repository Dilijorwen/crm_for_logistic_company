/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Plugin } from '@nocobase/server';
import type { SynchronizeShipmentChineseClients } from '../../application/logistics/SynchronizeShipmentChineseClients';
import type { LogisticsTransaction } from '../../application/logistics/ports/LogisticsRepository';
import { requireShipmentChineseClients } from '../../domain/logistics/ShipmentChineseClients';
import { extractIdentifier } from '../../domain/shared/Identifiers';
import { LogisticsError } from '../../domain/logistics/LogisticsError';
import { asLogisticsHttpError } from '../logistics/LogisticsHttpError';

interface ShipmentModel {
  get(name: string): unknown;
}
interface HookOptions {
  inputValues?: unknown;
  values?: unknown;
  transaction?: LogisticsTransaction;
}
function values(options: HookOptions): Record<string, unknown> {
  const value = options.inputValues ?? options.values;
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export class ShipmentChineseClientHooks {
  constructor(
    private readonly plugin: Plugin,
    private readonly synchronize: SynchronizeShipmentChineseClients,
  ) {}

  register(): void {
    this.plugin.db.on('shipments.beforeValidate', (_model: ShipmentModel, options: HookOptions) => {
      const input = values(options);
      if (!Object.prototype.hasOwnProperty.call(input, 'chinese_client')) return;
      try {
        requireShipmentChineseClients(input.chinese_client);
      } catch (error) {
        if (error instanceof LogisticsError) throw asLogisticsHttpError(error);
        throw error;
      }
    });
    this.plugin.db.on('shipments.afterSaveWithAssociations', async (model: ShipmentModel, options: HookOptions) => {
      const shipmentId = extractIdentifier(model.get('id'));
      if (shipmentId === null) return;
      try {
        await this.synchronize.execute({
          shipmentId,
          legacyClientId: extractIdentifier(model.get('chinese_client_id')),
          values: values(options),
          transaction: options.transaction,
        });
      } catch (error) {
        if (error instanceof LogisticsError) throw asLogisticsHttpError(error);
        throw error;
      }
    });
  }
}
