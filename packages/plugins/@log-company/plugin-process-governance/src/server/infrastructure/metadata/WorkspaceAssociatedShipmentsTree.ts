/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { WORKSPACE_SHIPMENT_VIEW_UID } from '../../../shared/workspace';
import { assignWorkspaceParents, workspaceColumn, type WorkspaceFlowTree } from './LogisticsWorkspaceNativeModels';

const COLUMNS = [
  ['shipment_number', 'Поставка'],
  ['status', 'Статус'],
  ['chinese_client.name', 'Клиент'],
  ['invoice_number', 'Инвойс'],
  ['application_number', 'ЗВ'],
  ['declaration_number', 'ДТ'],
  ['customs_scheme', 'Схема'],
  ['ntm_certificate_goods', 'СС/ДС'],
  ['ntm_skk_goods', 'СКК'],
] as const;

function columns(prefix: string, popup: boolean): WorkspaceFlowTree[] {
  return COLUMNS.map(([field, title], index) => {
    const column = workspaceColumn(`${prefix}${index}`, 'shipments', field, popup && field === 'shipment_number');
    column.props = { title, width: field === 'declaration_number' ? 220 : 140 };
    if (popup && field === 'shipment_number') {
      const value = column.subModels?.field as WorkspaceFlowTree;
      value.stepParams = {
        displayFieldSettings: { clickToOpen: { clickToOpen: true } },
        popupSettings: {
          openView: {
            uid: WORKSPACE_SHIPMENT_VIEW_UID,
            dataSourceKey: 'main',
            collectionName: 'shipments',
            mode: 'embed',
            navigation: false,
          },
        },
      };
    }
    return column;
  });
}

export function workspaceAssociatedShipmentsTree(): WorkspaceFlowTree {
  const tree: WorkspaceFlowTree = {
    uid: 'lcwsrunshipments',
    use: 'TableBlockModel',
    parentId: 'lcwsshipmentlistgrid',
    subKey: 'items',
    subType: 'array',
    stepParams: {
      resourceSettings: {
        init: {
          dataSourceKey: 'main',
          collectionName: 'shipments',
          associationName: 'transport_runs.shipments',
          sourceId: '{{ctx.view.inputArgs.workspaceRunId}}',
        },
      },
      tableSettings: { tableDensity: { size: 'small' }, showRowNumbers: { showIndex: false } },
    },
    subModels: {
      columns: [
        ...columns('lcwsrscol', true),
        {
          uid: 'lcwsrsactions',
          use: 'TableActionsColumnModel',
          props: { width: 56, title: '', fixed: 'right' },
          subModels: {
            actions: [
              {
                uid: 'lcwsdetach',
                use: 'LogisticsWorkspaceDisassociateActionModel',
                props: { title: 'Отвязать' },
                stepParams: { buttonSettings: { general: { title: 'Отвязать' } } },
              },
            ],
          },
        },
      ],
      actions: [
        {
          uid: 'lcwsrssearch',
          use: 'CollectionSearchActionModel',
          props: {
            searchPlaceholder: 'Поиск по всем данным',
            searchableFieldNames: [
              'shipment_number',
              'invoice_number',
              'application_number',
              'declaration_number',
              'chinese_client',
            ],
          },
        },
        {
          uid: 'lcwsrsnew',
          use: 'LogisticsWorkspaceShipmentAddActionModel',
          props: { title: 'Добавить поставку', type: 'primary' },
          stepParams: {
            buttonSettings: { general: { title: 'Добавить поставку', type: 'primary', icon: 'PlusOutlined' } },
            popupSettings: {
              openView: {
                uid: 'lcwsnewshipment',
                collectionName: 'shipments',
                associationName: null,
                sourceId: null,
                navigation: false,
                mode: 'dialog',
                size: 'large',
              },
            },
          },
          subModels: {
            associate: {
              uid: 'lcwsrsassociate',
              use: 'LogisticsWorkspaceAssociateActionModel',
              stepParams: { associateSettings: { openSelector: { mode: 'dialog', size: 'large' } } },
              subModels: {
                'associate-selector-grid': {
                  uid: 'lcwsrsassoselectgrid',
                  use: 'BlockGridModel',
                  async: true,
                  subModels: {
                    items: [
                      {
                        uid: 'lcwsrsassoselecttable',
                        use: 'TableSelectModel',
                        stepParams: {
                          resourceSettings: { init: { dataSourceKey: 'main', collectionName: 'shipments' } },
                          tableSettings: { tableDensity: { size: 'small' } },
                        },
                        subModels: {
                          columns: columns('lcwsrsassocol', false),
                          actions: [
                            {
                              uid: 'lcwsrsassosearch',
                              use: 'CollectionSearchActionModel',
                              props: {
                                searchPlaceholder: 'Поиск по всем данным',
                                searchableFieldNames: [
                                  'shipment_number',
                                  'invoice_number',
                                  'application_number',
                                  'declaration_number',
                                  'chinese_client',
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        {
          uid: 'lcwsrsdelete',
          use: 'LogisticsWorkspaceBulkDeleteActionModel',
          props: { title: 'Удалить', danger: true, icon: 'DeleteOutlined' },
        },
      ],
    },
  };
  assignWorkspaceParents(tree);
  return tree;
}
