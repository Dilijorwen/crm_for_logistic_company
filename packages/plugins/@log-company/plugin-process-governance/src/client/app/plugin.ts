/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { BulkDeleteActionModel, Plugin } from '@nocobase/client';
import enUS from '../../locale/en-US.json';
import ruRU from '../../locale/ru-RU.json';
import { StableFlowRoute } from './ui/StableFlowRoute';
import {
  LogisticsPage,
  LogisticsWorkspaceDeleteRunActionModel,
  LogisticsWorkspaceLinksActionModel,
  LogisticsWorkspaceRunActionModel,
  LogisticsWorkspaceShipmentActionModel,
} from '../pages/logistics';
import {
  LogisticsWorkspaceNewRunActionModel,
  LogisticsWorkspaceAddActionModel,
  LogisticsWorkspaceNewShipmentActionModel,
  LogisticsWorkspaceBulkDeleteActionModel,
  LogisticsWorkspaceRecordFieldModel,
  LogisticsWorkspaceShipmentAddActionModel,
  LogisticsWorkspaceDisassociateActionModel,
  LogisticsWorkspaceAssociateActionModel,
  LogisticsWorkspacePopupActionModel,
} from '../features/workspace-actions';
import {
  LogisticsWorkspaceContextBlockModel,
  LogisticsWorkspaceTabsBlockModel,
  LogisticsWorkspaceSectionPageModel,
} from '../widgets/workspace-context';
import { LogisticsWorkspaceHistoryBlockModel } from '../widgets/workspace-history';
import { LogisticsWorkspaceShipmentsBlockModel } from '../widgets/workspace-shipments';
import { LogisticsWorkspaceTableBlockModel } from '../widgets/workspace-table';
import {
  LogisticsWorkspaceShipmentEditFormModel,
  LogisticsWorkspaceShipmentSectionsGridModel,
} from '../widgets/workspace-shipment-page';
import { isWorkspaceDeleteContext } from '../shared/lib';
import { LogisticsWorkspaceRunDocumentsModel } from '../features/scoped-native-block/ui/WorkspaceRunDocumentsModel';
import { RunTreeActionModel } from '../widgets/run-tree';
import { RunTreeBlockModel } from '../widgets/run-tree';
import {
  ShipmentSynchronizedEditFormModel,
  LogisticsWorkspaceCreateFormModel,
  LogisticsWorkspaceScopedSelectFieldModel,
  LogisticsWorkspaceShipmentFieldsGridModel,
} from '../features/synchronize-shipment-form';
import {
  LogisticsWorkspaceShipmentFoldGridModel,
  LogisticsWorkspaceShipmentSubformModel,
} from '../features/synchronize-shipment-form/model/WorkspaceShipmentSubformModel';

const NAMESPACE = '@log-company/plugin-process-governance';

export class PluginProcessGovernanceClient extends Plugin {
  async afterAdd(): Promise<void> {
    // FlowEngine caches missing classes as error models, so register custom models before load hooks run.
    this.flowEngine.registerModels({
      LogisticsWorkspaceCreateFormModel,
      LogisticsWorkspaceScopedSelectFieldModel,
      LogisticsWorkspaceShipmentFieldsGridModel,
      LogisticsWorkspaceShipmentSubformModel,
      LogisticsWorkspaceShipmentFoldGridModel,
      LogisticsWorkspaceRunDocumentsModel,
      RunTreeBlockModel,
      RunTreeActionModel,
      LogisticsWorkspaceNewRunActionModel,
      LogisticsWorkspaceAddActionModel,
      LogisticsWorkspaceNewShipmentActionModel,
      LogisticsWorkspaceBulkDeleteActionModel,
      LogisticsWorkspaceRecordFieldModel,
      LogisticsWorkspaceShipmentAddActionModel,
      LogisticsWorkspaceDisassociateActionModel,
      LogisticsWorkspaceAssociateActionModel,
      LogisticsWorkspacePopupActionModel,
      LogisticsWorkspaceContextBlockModel,
      LogisticsWorkspaceSectionPageModel,
      LogisticsWorkspaceShipmentsBlockModel,
      LogisticsWorkspaceHistoryBlockModel,
      LogisticsWorkspaceTableBlockModel,
      LogisticsWorkspaceShipmentEditFormModel,
      LogisticsWorkspaceShipmentSectionsGridModel,
      LogisticsWorkspaceTabsBlockModel,
      LogisticsWorkspaceRunActionModel,
      LogisticsWorkspaceLinksActionModel,
      LogisticsWorkspaceShipmentActionModel,
      LogisticsWorkspaceDeleteRunActionModel,
    });
  }

  async load(): Promise<void> {
    this.app.addComponents({ FlowRoute: StableFlowRoute });
    this.flowEngine.registerModels({ EditFormModel: ShipmentSynchronizedEditFormModel });
    const deleteMetadata = BulkDeleteActionModel.meta;
    BulkDeleteActionModel.define({
      ...deleteMetadata,
      hide: (context) =>
        isWorkspaceDeleteContext(context) ||
        (typeof deleteMetadata?.hide === 'function' ? deleteMetadata.hide(context) : false),
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
