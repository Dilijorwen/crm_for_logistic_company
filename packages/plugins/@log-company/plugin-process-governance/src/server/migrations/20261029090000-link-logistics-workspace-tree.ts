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
import { LOGISTICS_WORKSPACE_VIEW_SQL } from '../infrastructure/read-model/LogisticsWorkspaceViewSql';

export default class extends Migration {
  on = 'afterLoad';

  async up(): Promise<void> {
    await this.db.sequelize.query(LOGISTICS_WORKSPACE_VIEW_SQL);
    await ensureLogisticsWorkspacePage(this.db);
  }
}
