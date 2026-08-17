/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin } from '@nocobase/client';
import { ProcessStatusSelect } from './processStatus/ProcessStatusSelect';
import { ProcessStatusSelectFieldModel } from './processStatus/ProcessStatusSelectFieldModel';

export * from './processContext/getInnermostRouteFilterByTk';
export * from './processStatus/processStatusOptions';

export class PluginProcessGovernanceClient extends Plugin {
  private readonly registerLegacyProcessStatusComponent = (): void => {
    const statusField = this.app.dataSourceManager
      .getDataSource('main')
      ?.collectionManager.getCollection('customs_processes')
      ?.getField('status');
    if (statusField?.uiSchema) {
      statusField.uiSchema['x-component'] = 'ProcessStatusSelect';
    }
  };

  async load(): Promise<void> {
    this.flowEngine.registerModels({
      SelectFieldModel: ProcessStatusSelectFieldModel,
    });
    this.app.addComponents({
      ProcessStatusSelect,
    });

    const mainDataSource = this.app.dataSourceManager.getDataSource('main');
    mainDataSource?.removeReloadCallback(this.registerLegacyProcessStatusComponent);
    mainDataSource?.addReloadCallback(this.registerLegacyProcessStatusComponent);
    this.registerLegacyProcessStatusComponent();
  }
}

export default PluginProcessGovernanceClient;
