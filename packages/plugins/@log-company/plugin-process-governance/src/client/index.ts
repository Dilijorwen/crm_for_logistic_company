/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin } from '@nocobase/client';
import enUS from '../locale/en-US.json';
import ruRU from '../locale/ru-RU.json';
import { LogisticsPage } from './logistics/LogisticsPage';
import { RunTreeActionModel } from './logistics/runTree/RunTreeActionModel';
import { RunTreeBlockModel } from './logistics/runTree/RunTreeBlockModel';
import { ShipmentSynchronizedEditFormModel } from './logistics/ShipmentSynchronizedEditFormModel';

const NAMESPACE = '@log-company/plugin-process-governance';

export * from './processContext/getInnermostRouteFilterByTk';
export * from './processContext/getFlowModelPopupCollectionMode';
export * from './processStatus/processStatusOptions';

export class PluginProcessGovernanceClient extends Plugin {
  async load(): Promise<void> {
    this.flowEngine.registerModels({
      EditFormModel: ShipmentSynchronizedEditFormModel,
      RunTreeBlockModel,
      RunTreeActionModel,
    });
    this.app.i18n.addResources('en-US', NAMESPACE, enUS);
    this.app.i18n.addResources('ru-RU', NAMESPACE, ruRU);
    this.app.router.add('admin.customs-clearance', {
      path: '/admin/customs-clearance',
      Component: LogisticsPage,
    });
  }
}

export default PluginProcessGovernanceClient;
