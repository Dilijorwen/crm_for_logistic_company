/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin } from '@nocobase/client';
import type { FlowModel, ToolbarItemConfig } from '@nocobase/flow-engine';
import models from './features/collection-search/model';
import { CollectionSearchActionModel } from './features/collection-search/model';

export function canConfigureCollectionSearch(model: FlowModel, currentRole: string | undefined): boolean {
  return !(model instanceof CollectionSearchActionModel) || currentRole === 'root';
}

export class PluginCollectionSearchClient extends Plugin {
  private restoreSettingsVisibility?: () => void;

  async load(): Promise<void> {
    this.flowEngine.registerModels(models);
    const settingsItem = this.flowEngine.flowSettings
      .getToolbarItems()
      .find((item: ToolbarItemConfig) => item.key === 'settings-menu');
    if (settingsItem) {
      const previousVisibility = settingsItem.visible;
      settingsItem.visible = (model) => {
        const wasVisible = previousVisibility ? previousVisibility(model) : true;
        return wasVisible && canConfigureCollectionSearch(model, this.app.apiClient.auth.role);
      };
      this.restoreSettingsVisibility = () => {
        settingsItem.visible = previousVisibility;
      };
    }
  }

  async unload(): Promise<void> {
    this.restoreSettingsVisibility?.();
    this.restoreSettingsVisibility = undefined;
  }
}

export default PluginCollectionSearchClient;
