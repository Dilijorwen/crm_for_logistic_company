/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import {
  assignWorkspaceParents,
  SHIPMENT_CUSTOMS,
  SHIPMENT_NTM,
  workspaceSourceForm,
  type WorkspaceFlowTree,
} from './LogisticsWorkspaceNativeModels';

const INITIAL_SHIPMENT_FIELDS = [
  'status',
  'chinese_client',
  'customs_scheme',
  'company',
  'contract_record',
  'customs_warehouse',
  'manager_comment',
];
const IMPORTER_SETTING = { label: { label: 'Импортер' } };

export function configureUnifiedRunForm(form: WorkspaceFlowTree, isNew: boolean): WorkspaceFlowTree {
  const grid = form.subModels?.grid as WorkspaceFlowTree;
  const originalItems = (grid.subModels?.items || []) as WorkspaceFlowTree[];
  const shipmentUid = `${form.uid}unifiedshipment`;
  const runItems = originalItems.filter((item) => item.uid !== shipmentUid);
  const names = isNew
    ? INITIAL_SHIPMENT_FIELDS
    : [
        ...INITIAL_SHIPMENT_FIELDS.slice(0, 6),
        'customs_warehouse_storage_date',
        'manager_comment',
        'declarant_comment',
        'invoice_number',
        'invoice_value',
        'goods_count',
        ...SHIPMENT_CUSTOMS,
        ...SHIPMENT_NTM,
      ];
  const shipmentGrid = workspaceSourceForm(`${shipmentUid}details`, 'shipments', names).subModels
    ?.grid as WorkspaceFlowTree;
  const fields = shipmentGrid.subModels?.items as WorkspaceFlowTree[];
  fields.forEach((item, index) => {
    item.stepParams = {
      ...item.stepParams,
      fieldSettings: {
        init: { dataSourceKey: 'main', collectionName: 'transport_runs', fieldPath: `shipments.${names[index]}` },
      },
      ...(names[index] === 'company'
        ? { editItemSettings: { ...(item.stepParams?.editItemSettings as object), ...IMPORTER_SETTING } }
        : {}),
    };
    if (names[index] === 'chinese_client') {
      const field = item.subModels?.field as WorkspaceFlowTree;
      field.stepParams = { selectSettings: { allowMultiple: { allowMultiple: true } } };
    }
  });
  const rows = [[fields[0]], fields.slice(1, 3), fields.slice(3, 5), fields.slice(5, isNew ? 6 : 7)];
  for (const field of fields.slice(isNew ? 6 : 7)) rows.push([field]);
  shipmentGrid.stepParams = {
    gridSettings: {
      grid: {
        rows: Object.fromEntries(
          rows.map((row, index) => [`${shipmentUid}row${index}`, row.map((item) => [item.uid])]),
        ),
      },
    },
  };
  const association: WorkspaceFlowTree = {
    uid: shipmentUid,
    use: 'FormItemModel',
    stepParams: {
      fieldSettings: { init: { dataSourceKey: 'main', collectionName: 'transport_runs', fieldPath: 'shipments' } },
    },
    subModels: {
      field: {
        uid: `${shipmentUid}field`,
        use: 'LogisticsWorkspaceShipmentSubformModel',
        stepParams: {
          subFormListSettings: {
            allowDisassociation: { allowDisassociation: false },
            allowSelectExistingRecord: { allowSelectExistingRecord: true },
          },
        },
        subModels: { grid: shipmentGrid },
      },
    },
  };
  grid.subModels = { ...grid.subModels, items: [...runItems, association] };
  grid.stepParams = {
    ...grid.stepParams,
    gridSettings: {
      grid: {
        rows: { details: [runItems.map((item) => item.uid), [shipmentUid]] },
        sizes: { details: [10, 14] },
      },
    },
  };
  form.props = { ...form.props, workspaceUnified: true };
  const actions = form.subModels?.actions as WorkspaceFlowTree[];
  const submit = actions?.find((action) => action.use === 'FormSubmitActionModel');
  if (submit) {
    const title = isNew ? 'Создать рейс' : 'Сохранить изменения';
    submit.props = { ...submit.props, title };
    submit.stepParams = { ...submit.stepParams, buttonSettings: { general: { title, type: 'primary' } } };
  }
  assignWorkspaceParents(form);
  return form;
}
