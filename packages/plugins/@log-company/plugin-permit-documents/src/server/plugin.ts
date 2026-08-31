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
import { PermitDocumentsModule } from './composition/PermitDocumentsModule';

export class PluginPermitDocumentsServer extends Plugin {
  private module: PermitDocumentsModule | null = null;

  async load(): Promise<void> {
    await this.importCollections(path.resolve(__dirname, 'collections'));
    this.db.addMigrations({
      namespace: 'log-company-permit-documents',
      directory: path.resolve(__dirname, 'migrations'),
      context: { plugin: this },
    });
    this.module = new PermitDocumentsModule(this);
    this.module.initialize();
  }

  async afterDisable(): Promise<void> {
    this.module?.dispose();
  }

  async remove(): Promise<void> {
    this.module?.dispose();
  }
}

export default PluginPermitDocumentsServer;
