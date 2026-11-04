/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { FilterActionModel, Plugin, TableBlockModel } from '@nocobase/client';
import type { ModelConstructor } from '@nocobase/flow-engine';
import { TableTemplatesBlockModel } from '../widgets/table-templates';
import { withColumnWidth } from '../features/table-personalization';
import { RESIZABLE_COLUMN_MODELS } from '../../shared/contracts';
import { SavedFilterActionModel } from '../features/filter-templates';

export class PluginTablePersonalizationClient extends Plugin {
  private previousModel?: ModelConstructor;
  private previousFilterModel?: ModelConstructor;
  private readonly widthModels = new Map<string, { original: ModelConstructor; replacement: ModelConstructor }>();

  async load(): Promise<void> {
    const current = this.flowEngine.getModelClass('TableBlockModel');
    if (current && current !== TableBlockModel && current !== TableTemplatesBlockModel) {
      throw new Error('TableBlockModel is already extended by another plugin.');
    }
    this.previousModel = current;
    const filter = this.flowEngine.getModelClass('FilterActionModel');
    if (filter && filter !== FilterActionModel && filter !== SavedFilterActionModel) {
      throw new Error('FilterActionModel is already extended by another plugin.');
    }
    this.previousFilterModel = filter;
    this.flowEngine.registerModels({ FilterActionModel: SavedFilterActionModel });
    this.flowEngine.registerModels({ TableBlockModel: TableTemplatesBlockModel });
    for (const name of RESIZABLE_COLUMN_MODELS) {
      const original = this.flowEngine.getModelClass(name);
      if (!original) continue;
      const replacement = withColumnWidth(original);
      this.widthModels.set(name, { original, replacement });
      this.flowEngine.registerModels({ [name]: replacement });
    }
  }

  async unload(): Promise<void> {
    if (this.previousFilterModel && this.flowEngine.getModelClass('FilterActionModel') === SavedFilterActionModel) {
      this.flowEngine.registerModels({ FilterActionModel: this.previousFilterModel });
    }
    for (const [name, { original, replacement }] of this.widthModels) {
      if (this.flowEngine.getModelClass(name) === replacement) this.flowEngine.registerModels({ [name]: original });
    }
    this.widthModels.clear();
    if (this.previousModel && this.flowEngine.getModelClass('TableBlockModel') === TableTemplatesBlockModel) {
      this.flowEngine.registerModels({ TableBlockModel: this.previousModel });
    }
  }
}

export default PluginTablePersonalizationClient;
