/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Migration } from '@nocobase/server';
import { ensureLogisticsWorkspacePage } from '../infrastructure/metadata/LogisticsWorkspacePage';

/**
 * A flow-page route creates its root model automatically in NocoBase 2.0.60.
 * Re-run the idempotent page builder for instances upgraded before that runtime
 * behaviour was accounted for.
 */
export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await ensureLogisticsWorkspacePage(this.db);
  }

  async down(): Promise<void> {
    // Retain the operational page and personal column settings.
  }
}
