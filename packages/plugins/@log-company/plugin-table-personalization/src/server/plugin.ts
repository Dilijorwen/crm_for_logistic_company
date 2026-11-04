/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin } from '@nocobase/server';
import { TablePersonalizationModule } from './composition/TablePersonalizationModule';
import { TableFilterTemplateModule } from './composition/TableFilterTemplateModule';

export class PluginTablePersonalizationServer extends Plugin {
  async load(): Promise<void> {
    new TablePersonalizationModule(this).initialize();
    new TableFilterTemplateModule(this).initialize();
  }

  async install(): Promise<void> {
    const { afterLoad } = await this.loadMigrations();
    await this.db.createMigrator({ migrations: afterLoad }).up();
  }
}

export default PluginTablePersonalizationServer;
