/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import { LEGACY_PROCESS_COLLECTIONS } from '../../shared/legacyProcessCollections';

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    if (!this.db.getCollection('collections')) return;
    // Archive designer metadata only; legacy rows and saved references must remain intact.
    await this.db.getRepository('collections').update({
      filter: { name: { $in: [...LEGACY_PROCESS_COLLECTIONS] } },
      values: { hidden: true },
    });
  }
}
