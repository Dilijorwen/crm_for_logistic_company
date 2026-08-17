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
import { OrganizationStructureModule } from './composition/OrganizationStructureModule';

export class PluginOrganizationStructureServer extends Plugin {
  async load(): Promise<void> {
    this.db.addMigrations({
      namespace: 'log-company-organization-structure',
      directory: path.resolve(__dirname, 'migrations'),
      context: { plugin: this },
    });
    new OrganizationStructureModule(this).initialize();
  }
}

export default PluginOrganizationStructureServer;
