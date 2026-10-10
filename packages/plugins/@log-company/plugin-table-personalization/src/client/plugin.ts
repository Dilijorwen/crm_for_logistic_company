/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin, TableBlockModel } from '@nocobase/client';
import type { ModelConstructor } from '@nocobase/flow-engine';
import { PersonalizedTableBlockModel } from './features/table-personalization/model/PersonalizedTableBlockModel';
import { withColumnWidth } from './features/table-personalization/model/columnWidthBinding';
import { RESIZABLE_COLUMN_MODELS } from '../shared/contracts';

export class PluginTablePersonalizationClient extends Plugin {
  private previousModel?: ModelConstructor;
  private readonly widthModels = new Map<string, { original: ModelConstructor; replacement: ModelConstructor }>();

  async load(): Promise<void> {
    const current = this.flowEngine.getModelClass('TableBlockModel');
    if (current && current !== TableBlockModel && current !== PersonalizedTableBlockModel) {
      throw new Error('TableBlockModel is already extended by another plugin.');
    }
    this.previousModel = current;
    this.flowEngine.registerModels({ TableBlockModel: PersonalizedTableBlockModel });
    for (const name of RESIZABLE_COLUMN_MODELS) {
      const original = this.flowEngine.getModelClass(name);
      if (!original) continue;
      const replacement = withColumnWidth(original);
      this.widthModels.set(name, { original, replacement });
      this.flowEngine.registerModels({ [name]: replacement });
    }
  }

  async unload(): Promise<void> {
    for (const [name, { original, replacement }] of this.widthModels) {
      if (this.flowEngine.getModelClass(name) === replacement) this.flowEngine.registerModels({ [name]: original });
    }
    this.widthModels.clear();
    if (this.previousModel && this.flowEngine.getModelClass('TableBlockModel') === PersonalizedTableBlockModel) {
      this.flowEngine.registerModels({ TableBlockModel: this.previousModel });
    }
  }
}

export default PluginTablePersonalizationClient;
