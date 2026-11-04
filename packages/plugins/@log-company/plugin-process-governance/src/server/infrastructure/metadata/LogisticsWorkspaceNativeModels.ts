/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { FieldOptions } from '@nocobase/database';
import shipments from '../../collections/shipments';
import transportRuns from '../../collections/transportRuns';
import logisticsWorkItems from '../../collections/logisticsWorkItems';
import { logisticsAssociationFields } from './LogisticsAssociationFields';
import { workspaceRunFormSections } from './WorkspaceRunFormSections';

export const WORKSPACE_RECORD_POPUP_UID = 'lcwsrecordpopup';
export const WORKSPACE_CREATE_RUN_UID = 'lclogworknewrun';
export const WORKSPACE_CREATE_SHIPMENT_UID = 'lcwsnewshipment';
export const WORKSPACE_DELETE_UID = 'lcwsdeleteshipment';
export const WORKSPACE_ADD_UID = 'lcwsadd';

export interface WorkspaceFlowTree {
  uid: string;
  use: string;
  async?: boolean;
  props?: Record<string, unknown>;
  decoratorProps?: Record<string, unknown>;
  stepParams?: Record<string, unknown>;
  parentId?: string;
  subKey?: string;
  subType?: 'array' | 'object';
  subModels?: Record<string, WorkspaceFlowTree | WorkspaceFlowTree[]>;
}

const RUN_FIELDS = [
  'transport_type',
  'registration_number_input',
  'departure_city',
  'managers',
  'declarants',
  'parent_runs',
];
const SHIPMENT_GENERAL = [
  'chinese_client',
  'company',
  'status',
  'invoice_number',
  'invoice_value',
  'contract_record',
  'customs_scheme',
  'customs_warehouse',
  'customs_warehouse_storage_date',
  'goods_count',
  'manager_comment',
];
const SHIPMENT_CUSTOMS = [
  'declaration_number',
  'application_number',
  'documents_in_badis',
  'customs_payments_amount',
  'eco_fee',
  'ktc_amount',
  'entered_in_1c',
  'sent_to_client',
  'additional_check_response_deadline',
  'actual_control',
  'anosov_distributed',
];
const SHIPMENT_NTM = [
  'ntm_certificate_goods',
  'ntm_skk_goods',
  'ntm_kfk_goods',
  'ntm_honest_sign_goods',
  'ntm_export_declaration_required',
  'ntm_honest_sign_sum',
];

function fieldModel(field: FieldOptions): string {
  if (['belongsTo', 'belongsToMany', 'hasMany'].includes(field.type)) return 'RecordSelectFieldModel';
  if (field.interface === 'select') return 'SelectFieldModel';
  if (field.type === 'boolean') return 'CheckboxFieldModel';
  if (field.type === 'dateOnly') return 'DateOnlyFieldModel';
  if (['double', 'integer', 'bigInt'].includes(field.type)) return 'NumberFieldModel';
  return field.type === 'text' ? 'TextareaFieldModel' : 'InputFieldModel';
}

function form(
  uid: string,
  collectionName: 'transport_runs' | 'shipments',
  names: string[],
  create = false,
): WorkspaceFlowTree {
  const definitions = [
    ...((collectionName === 'transport_runs' ? transportRuns.fields : shipments.fields) || []),
    ...logisticsAssociationFields
      .filter((entry) => entry.collectionName === collectionName)
      .map((entry) => entry.field as FieldOptions),
  ];
  const tree: WorkspaceFlowTree = {
    uid,
    use: create ? 'LogisticsWorkspaceCreateFormModel' : 'EditFormModel',
    stepParams: {
      resourceSettings: {
        init: {
          dataSourceKey: 'main',
          collectionName,
          associationName: null,
          sourceId: null,
          ...(!create
            ? {
                filterByTk:
                  collectionName === 'transport_runs'
                    ? '{{ctx.view.inputArgs.workspaceRunId}}'
                    : '{{ctx.view.inputArgs.workspaceShipmentId}}',
              }
            : {}),
        },
      },
      formSettings: { layout: { layout: 'vertical' } },
    },
    subModels: {
      grid: {
        uid: `${uid}grid`,
        use: 'FormGridModel',
        stepParams: {
          gridSettings: {
            grid: {
              rows: Object.fromEntries(
                Array.from({ length: Math.ceil(names.length / 2) }, (_, index) => [
                  `${uid}row${index}`,
                  names.slice(index * 2, index * 2 + 2).map((_, offset) => [`${uid}f${index * 2 + offset + 1}`]),
                ]),
              ),
            },
          },
        },
        subModels: {
          items: names.map((name, index) => {
            const definition = definitions?.find((field) => field.name === name);
            if (!definition) throw new Error(`Не найдено поле формы ${collectionName}.${name}`);
            const itemUid = `${uid}f${index + 1}`;
            return {
              uid: itemUid,
              use: 'FormItemModel',
              stepParams: {
                fieldSettings: { init: { dataSourceKey: 'main', collectionName, fieldPath: name } },
                ...(definition.uiSchema?.required || definition.allowNull === false || (create && name === 'runs')
                  ? { editItemSettings: { required: { required: true } } }
                  : {}),
              },
              subModels: { field: { uid: `${itemUid}input`, use: fieldModel(definition) } },
            };
          }),
        },
      },
      actions: [
        {
          uid: `${uid}save`,
          use: 'FormSubmitActionModel',
          props: { title: create ? 'Создать' : 'Сохранить', type: 'primary' },
          stepParams: {
            buttonSettings: {
              general: {
                title: create
                  ? 'Создать'
                  : collectionName === 'transport_runs'
                    ? 'Сохранить рейс'
                    : 'Сохранить поставку',
                type: 'primary',
              },
            },
            submitSettings: {
              afterSuccess: { successMessage: 'Сохранено', actionAfterSuccess: create ? 'previous' : 'stay' },
            },
          },
        },
      ],
    },
  };
  if (collectionName === 'transport_runs' && !names.includes('shipments') && tree.subModels)
    tree.subModels.grid = workspaceRunFormSections(tree.subModels.grid as WorkspaceFlowTree);
  return tree;
}

function grid(uid: string, items: WorkspaceFlowTree[]): WorkspaceFlowTree {
  return { uid, use: 'BlockGridModel', subModels: { items } };
}

function tab(uid: string, title: string, items: WorkspaceFlowTree[]): WorkspaceFlowTree {
  return {
    uid,
    use: 'ChildPageTabModel',
    stepParams: { pageTabSettings: { tab: { title } } },
    subModels: { grid: { ...grid(`${uid}grid`, items), async: true } },
  };
}

function context(
  uid: string,
  entity: 'run' | 'shipment',
  items: WorkspaceFlowTree[],
  creation = false,
): WorkspaceFlowTree {
  return {
    uid,
    use: 'LogisticsWorkspaceContextBlockModel',
    props: { entity, creation },
    subModels: { grid: grid(`${uid}grid`, items) },
  };
}

function column(uid: string, collectionName: string, fieldPath: string, popup = false): WorkspaceFlowTree {
  const definition = (collectionName === 'logistics_work_items' ? logisticsWorkItems : shipments).fields?.find(
    (field) => field.name === fieldPath,
  );
  const fieldInterface = definition?.interface;
  const use = popup
    ? 'LogisticsWorkspaceRecordFieldModel'
    : ['select', 'multipleSelect', 'radioGroup', 'checkboxGroup'].includes(String(fieldInterface)) ||
        fieldPath === 'event_type'
      ? 'DisplayEnumFieldModel'
      : ['number', 'integer', 'percent'].includes(String(fieldInterface))
        ? 'DisplayNumberFieldModel'
        : fieldInterface === 'checkbox'
          ? 'DisplayCheckboxFieldModel'
          : fieldInterface === 'date' || fieldPath === 'createdAt'
            ? 'DisplayDateTimeFieldModel'
            : 'DisplayTextFieldModel';
  return {
    uid,
    use: 'TableColumnModel',
    stepParams: {
      fieldSettings: { init: { dataSourceKey: 'main', collectionName, fieldPath } },
      tableColumnSettings: { model: { use } },
    },
    subModels: {
      field: {
        uid: `${uid}value`,
        use,
        stepParams: popup
          ? {
              displayFieldSettings: { clickToOpen: { clickToOpen: true } },
              popupSettings: {
                openView: {
                  uid: WORKSPACE_RECORD_POPUP_UID,
                  navigation: false,
                  collectionName: 'logistics_work_items',
                  dataSourceKey: 'main',
                  mode: 'drawer',
                  size: 'large',
                },
              },
            }
          : {},
      },
    },
  };
}

function associatedShipments(): WorkspaceFlowTree {
  return {
    uid: 'lcwsrunshipments',
    use: 'TableBlockModel',
    decoratorProps: { title: 'Поставки рейса' },
    stepParams: {
      resourceSettings: {
        init: {
          dataSourceKey: 'main',
          collectionName: 'shipments',
          associationName: 'transport_runs.shipments',
          sourceId: '{{ctx.view.inputArgs.workspaceRunId}}',
        },
      },
      tableSettings: { tableDensity: { size: 'small' } },
    },
    subModels: {
      columns: [
        column('lcwsrsname', 'shipments', 'shipment_number', true),
        column('lcwsrsstatus', 'shipments', 'status'),
        column('lcwsrsclient', 'shipments', 'chinese_client'),
        {
          uid: 'lcwsrsactions',
          use: 'TableActionsColumnModel',
          subModels: {
            actions: [
              {
                uid: 'lcwsdetach',
                use: 'DisassociateActionModel',
                props: { title: 'Отвязать' },
                stepParams: { buttonSettings: { general: { title: 'Отвязать' } } },
              },
            ],
          },
        },
      ],
      actions: [
        {
          uid: 'lcwsrsnew',
          use: 'LogisticsWorkspaceNewShipmentActionModel',
          props: { title: 'Добавить поставку' },
          stepParams: {
            buttonSettings: { general: { title: 'Добавить поставку', type: 'primary', icon: 'PlusOutlined' } },
            popupSettings: {
              openView: {
                uid: WORKSPACE_CREATE_SHIPMENT_UID,
                collectionName: 'shipments',
                associationName: null,
                sourceId: null,
                navigation: false,
              },
            },
          },
        },
      ],
    },
  };
}

function history(uid: string, entity: 'run' | 'shipment'): WorkspaceFlowTree {
  const collectionName = entity === 'run' ? 'transport_run_history' : 'shipment_history';
  return {
    uid,
    use: 'TableBlockModel',
    stepParams: {
      resourceSettings: {
        init: {
          dataSourceKey: 'main',
          collectionName,
          associationName: entity === 'run' ? 'transport_runs.history' : 'shipments.history',
          sourceId:
            entity === 'run' ? '{{ctx.view.inputArgs.workspaceRunId}}' : '{{ctx.view.inputArgs.workspaceShipmentId}}',
        },
      },
      tableSettings: { tableDensity: { size: 'small' } },
    },
    subModels: {
      columns: ['createdAt', 'event_type', 'field_label', 'old_value', 'new_value'].map((name, index) =>
        column(`${uid}c${index}`, collectionName, name),
      ),
    },
  };
}

function sectionPage(uid: string, tabs: WorkspaceFlowTree[]): WorkspaceFlowTree {
  return {
    uid,
    use: 'LogisticsWorkspaceSectionPageModel',
    stepParams: { pageSettings: { general: { enableTabs: true, displayTitle: false } } },
    subModels: { tabs },
  };
}

export function logisticsWorkspaceNativeTrees(): WorkspaceFlowTree[] {
  const shipmentEditor = context('lcwsshipcontext', 'shipment', [
    {
      uid: 'lcwsshiptabs',
      use: 'LogisticsWorkspaceTabsBlockModel',
      subModels: {
        page: sectionPage('lcwsshippage', [
          tab('lcwsshipgeneral', 'Основное', [form('lcwsshipform', 'shipments', SHIPMENT_GENERAL)]),
          tab('lcwsshipcustoms', 'Оформление', [form('lcwscustomsform', 'shipments', SHIPMENT_CUSTOMS)]),
          tab('lcwsshipntm', 'НТМ', [form('lcwsntmform', 'shipments', SHIPMENT_NTM)]),
          tab('lcwsshipdocs', 'Документы', [{ uid: 'lcwsdocuments', use: 'ProcessDocumentsBlockModel' }]),
          tab('lcwsshipdiscussion', 'Обсуждение', [{ uid: 'lcwsdiscussion', use: 'ProcessDiscussionBlockModel' }]),
          tab('lcwsshiphistory', 'История', [history('lcwsshiphistorytable', 'shipment')]),
        ]),
      },
    },
  ]);
  shipmentEditor.props = { entity: 'shipment', isolated: true };
  const createRun: WorkspaceFlowTree = {
    uid: WORKSPACE_CREATE_RUN_UID,
    use: 'LogisticsWorkspaceNewRunActionModel',
    props: { kind: 'run' },
    stepParams: {
      popupSettings: {
        openView: {
          dataSourceKey: 'main',
          collectionName: 'transport_runs',
          navigation: false,
          mode: 'dialog',
          size: 'large',
        },
      },
    },
    subModels: {
      page: {
        uid: 'lcwsnewrunpage',
        use: 'ChildPageModel',
        async: true,
        subModels: {
          tabs: [
            tab('lcwsnewruntab', 'Новый рейс', [
              context('lcwsnewruncontext', 'run', [form('lcwscreaterun', 'transport_runs', RUN_FIELDS, true)], true),
            ]),
          ],
        },
      },
    },
  };
  const createShipment: WorkspaceFlowTree = {
    uid: WORKSPACE_CREATE_SHIPMENT_UID,
    use: 'LogisticsWorkspaceNewShipmentActionModel',
    props: { kind: 'shipment' },
    stepParams: {
      popupSettings: {
        openView: {
          dataSourceKey: 'main',
          collectionName: 'shipments',
          navigation: false,
          mode: 'dialog',
          size: 'large',
        },
      },
    },
    subModels: {
      page: sectionPage('lcwsnewshippage', [
        tab('lcwsnewshiptab', 'Данные поставки', [
          context(
            'lcwsnewshipcontext',
            'shipment',
            [
              form(
                'lcwscreateship',
                'shipments',
                ['runs', ...SHIPMENT_GENERAL, ...SHIPMENT_CUSTOMS, ...SHIPMENT_NTM],
                true,
              ),
            ],
            true,
          ),
        ]),
        tab('lcwsnewshipdocstab', 'Документы', [
          context(
            'lcwsnewshipdocscontext',
            'shipment',
            [{ uid: 'lcwscreatedocuments', use: 'ProcessDocumentsBlockModel' }],
            true,
          ),
        ]),
      ]),
    },
  };
  const trees: WorkspaceFlowTree[] = [
    {
      uid: WORKSPACE_RECORD_POPUP_UID,
      use: 'PopupActionModel',
      parentId: 'lclogworkspacetable',
      subKey: 'recordPopup',
      subType: 'object',
      stepParams: {
        popupSettings: {
          openView: {
            dataSourceKey: 'main',
            collectionName: 'logistics_work_items',
            mode: 'drawer',
            size: 'large',
            navigation: false,
          },
        },
      },
      subModels: {
        page: {
          uid: 'lcwsrecordpage',
          use: 'ChildPageModel',
          async: true,
          stepParams: {
            pageSettings: { general: { enableTabs: true, displayTitle: false, title: 'Редактирование рейса' } },
          },
          subModels: {
            tabs: [
              tab('lcwsruntab', 'Рейс', [
                context('lcwsruncontext', 'run', [form('lcwsrunform', 'transport_runs', [...RUN_FIELDS, 'shipments'])]),
              ]),
              tab('lcwsshiptab', 'Поставки', [
                {
                  uid: 'lcwsshipmentselector',
                  use: 'LogisticsWorkspaceShipmentsBlockModel',
                  subModels: { list: grid('lcwsshipmentlistgrid', [associatedShipments()]), editor: shipmentEditor },
                },
              ]),
              tab('lcwsruntreetab', 'Дерево', [
                context('lcwsruntreecontext', 'run', [{ uid: 'lcwsruntree', use: 'RunTreeBlockModel' }]),
              ]),
              tab('lcwsrunhistorytab', 'История', [
                context('lcwsrunhistorycontext', 'run', [history('lcwsrunhistorytable', 'run')]),
              ]),
            ],
          },
        },
      },
    },
    {
      uid: WORKSPACE_ADD_UID,
      use: 'LogisticsWorkspaceAddActionModel',
      props: { title: 'Добавить рейс' },
      parentId: 'lclogworkspacetable',
      subKey: 'actions',
      subType: 'array',
      stepParams: {
        buttonSettings: { general: { title: 'Добавить рейс', type: 'primary', icon: 'PlusOutlined' } },
        popupSettings: {
          openView: {
            uid: WORKSPACE_CREATE_RUN_UID,
            collectionName: 'transport_runs',
            dataSourceKey: 'main',
            navigation: false,
            mode: 'dialog',
            size: 'large',
          },
        },
      },
      subModels: { creators: [createRun, createShipment] },
    },
    {
      uid: WORKSPACE_DELETE_UID,
      use: 'LogisticsWorkspaceBulkDeleteActionModel',
      parentId: 'lclogworkspacetable',
      subKey: 'actions',
      subType: 'array',
      props: { title: 'Удалить', danger: true, icon: 'DeleteOutlined' },
    },
  ];
  for (const tree of trees) assignParents(tree);
  return trees;
}

function assignParents(tree: WorkspaceFlowTree): void {
  for (const [subKey, value] of Object.entries(tree.subModels || {})) {
    for (const child of Array.isArray(value) ? value : [value]) {
      child.parentId = tree.uid;
      child.subKey = subKey;
      child.subType = Array.isArray(value) ? 'array' : 'object';
      assignParents(child);
    }
  }
}

export {
  form as workspaceSourceForm,
  history as workspaceHistory,
  column as workspaceColumn,
  assignParents as assignWorkspaceParents,
  RUN_FIELDS,
  SHIPMENT_GENERAL,
  SHIPMENT_CUSTOMS,
  SHIPMENT_NTM,
};
