/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import path from 'path';
import { Plugin } from '@nocobase/server';
import { LogisticsModule } from './composition/LogisticsModule';
import { ProcessGovernanceModule } from './composition/ProcessGovernanceModule';

export class PluginProcessGovernanceServer extends Plugin {
  async load(): Promise<void> {
    await this.importCollections(path.resolve(__dirname, 'collections'));
    this.db.addMigrations({
      namespace: 'process-governance',
      directory: path.resolve(__dirname, 'migrations'),
      context: { plugin: this },
    });
    new ProcessGovernanceModule(this).initialize();
    new LogisticsModule(this).initialize();
  }
}

export default PluginProcessGovernanceServer;
