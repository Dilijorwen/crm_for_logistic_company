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
import { ChatModule } from './composition/ChatModule';

export class PluginChatsServer extends Plugin {
  async load(): Promise<void> {
    await this.importCollections(path.resolve(__dirname, 'collections'));
    this.db.addMigrations({
      namespace: 'log-company-chats',
      directory: path.resolve(__dirname, 'migrations'),
      context: { plugin: this },
    });
    await new ChatModule(this).initialize();
  }
}

export default PluginChatsServer;
