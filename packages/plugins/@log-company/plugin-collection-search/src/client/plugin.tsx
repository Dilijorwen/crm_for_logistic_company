/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin } from '@nocobase/client';
import models from './features/collection-search/model';
import { NAMESPACE } from './locale';
import enUS from '../locale/en-US.json';
import ruRU from '../locale/ru-RU.json';

export class PluginCollectionSearchClient extends Plugin {
  async load(): Promise<void> {
    this.app.i18n.addResources('en-US', NAMESPACE, enUS);
    this.app.i18n.addResources('ru-RU', NAMESPACE, ruRU);
    this.flowEngine.registerModels(models);
  }
}

export default PluginCollectionSearchClient;
