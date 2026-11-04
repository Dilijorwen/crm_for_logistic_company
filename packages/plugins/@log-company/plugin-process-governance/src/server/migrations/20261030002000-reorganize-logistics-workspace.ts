/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import { ensureTransportTypeSchema } from '../infrastructure/persistence/nocobase/TransportTypeSchema';
import { retireShipmentNames } from '../infrastructure/metadata/RetireShipmentNames';
import { upgradeLogisticsWorkspace } from '../infrastructure/metadata/UpgradeLogisticsWorkspace';

export default class extends Migration {
  on = 'afterLoad';
  async up(): Promise<void> {
    await ensureTransportTypeSchema(this.db);
    await retireShipmentNames(this.db);
    await upgradeLogisticsWorkspace(this.db);
  }
}
