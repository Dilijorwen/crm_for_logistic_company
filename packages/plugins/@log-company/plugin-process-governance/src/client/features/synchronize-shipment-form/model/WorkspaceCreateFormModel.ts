/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { CreateFormModel, type ResourceSettingsInitParams } from '@nocobase/client';
import type { FlowModelContext } from '@nocobase/flow-engine';
import { refreshShipmentConsumers } from './ShipmentSynchronizedEditFormModel';

/** Refresh both the open run and its work list after creating a source record. */
export class LogisticsWorkspaceCreateFormModel extends CreateFormModel {
  createResource(context: FlowModelContext, params: ResourceSettingsInitParams) {
    const resource = super.createResource(context, params);
    const save = resource.save.bind(resource);
    resource.save = async (data, options) => {
      const result = await save(data, options);
      const refresh = await refreshShipmentConsumers(this.flowEngine, resource);
      if (refresh.errors.length)
        this.context.message.warning('Запись создана, но связанные списки не обновились. Обновите страницу.');
      return result;
    };
    return resource;
  }
}
const metadata = CreateFormModel.meta;
if (!metadata) throw new Error('CreateFormModel metadata is not registered');
LogisticsWorkspaceCreateFormModel.define({
  ...metadata,
  label: 'Форма создания рейса или поставки',
  createModelOptions: {
    use: 'LogisticsWorkspaceCreateFormModel',
    subModels: { grid: { use: 'FormGridModel' } },
  },
});
