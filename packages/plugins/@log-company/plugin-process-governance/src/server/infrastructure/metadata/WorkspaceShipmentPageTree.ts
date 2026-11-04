/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { WORKSPACE_SHIPMENT_VIEW_UID } from '../../../shared/workspace';
import {
  workspaceSourceForm,
  workspaceHistory,
  assignWorkspaceParents,
  type WorkspaceFlowTree,
} from './LogisticsWorkspaceNativeModels';
import { SHIPMENT_FORM_SECTIONS } from './WorkspaceShipmentFormSections';

function section(uid: string, title: string, names: string[]): WorkspaceFlowTree {
  const source = workspaceSourceForm(uid, 'shipments', names);
  const grid = source.subModels?.grid as WorkspaceFlowTree;
  grid.props = { workspaceSectionTitle: title };
  return grid;
}

/** One native form owns all fields and one native submit action across its sections. */
export function workspaceShipmentPageTree(): WorkspaceFlowTree {
  const editor = workspaceSourceForm('lcwspageform', 'shipments', []);
  editor.use = 'LogisticsWorkspaceShipmentEditFormModel';
  const formSections = [
    ...SHIPMENT_FORM_SECTIONS.map((definition, index) =>
      section(['lcwspagegeneral', 'lcwspagecustoms', 'lcwspagentm'][index], definition.title, definition.fields),
    ),
    { uid: 'lcwspagedocs', use: 'ProcessDocumentsBlockModel', props: { workspaceSectionTitle: 'Документы' } },
    { uid: 'lcwspagediscussion', use: 'ProcessDiscussionBlockModel', props: { workspaceSectionTitle: 'Обсуждение' } },
    { ...workspaceHistory('lcwspagehistory', 'shipment'), props: { workspaceSectionTitle: 'История' } },
  ];
  editor.subModels = {
    ...editor.subModels,
    grid: {
      uid: 'lcwspageformgrid',
      use: 'LogisticsWorkspaceShipmentSectionsGridModel',
      subModels: { sections: formSections },
    },
  };
  const tree: WorkspaceFlowTree = {
    uid: WORKSPACE_SHIPMENT_VIEW_UID,
    use: 'PopupActionModel',
    parentId: 'lclogworkspacetable',
    subKey: 'shipmentPage',
    subType: 'object',
    stepParams: {
      popupSettings: {
        openView: { dataSourceKey: 'main', collectionName: 'shipments', mode: 'embed', navigation: false },
      },
    },
    subModels: {
      page: {
        uid: 'lcwsshipmentfullpage',
        use: 'LogisticsWorkspaceSectionPageModel',
        async: true,
        stepParams: { pageSettings: { general: { enableTabs: false, displayTitle: false } } },
        subModels: {
          tabs: [
            {
              uid: 'lcwsshipmentfulltab',
              use: 'ChildPageTabModel',
              stepParams: { pageTabSettings: { tab: { title: 'Поставка' } } },
              subModels: {
                grid: {
                  uid: 'lcwsshipmentfullgrid',
                  use: 'BlockGridModel',
                  async: true,
                  subModels: { items: [editor] },
                },
              },
            },
          ],
        },
      },
    },
  };
  assignWorkspaceParents(tree);
  return tree;
}
