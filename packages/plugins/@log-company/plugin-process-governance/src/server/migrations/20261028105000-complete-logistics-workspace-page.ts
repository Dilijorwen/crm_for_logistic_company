/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please see: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import { ensureLogisticsWorkspacePage } from '../infrastructure/metadata/LogisticsWorkspacePage';

/**
 * Completes pages where an earlier upgrade created the table block before
 * NocoBase had finished adding the columns and actions. The builder is
 * idempotent, so it preserves every model that is already in place.
 */
export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await ensureLogisticsWorkspacePage(this.db);
  }

  async down(): Promise<void> {
    // Keep the operational page and users' personal column settings.
  }
}
