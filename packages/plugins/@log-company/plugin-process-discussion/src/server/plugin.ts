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
import { ProcessDiscussionModule } from './composition/ProcessDiscussionModule';

export class PluginProcessDiscussionServer extends Plugin {
  async load(): Promise<void> {
    this.db.addMigrations({
      namespace: 'process-discussion',
      directory: path.resolve(__dirname, 'migrations'),
      context: { plugin: this },
    });
    new ProcessDiscussionModule(this).initialize();
  }
}

export default PluginProcessDiscussionServer;
