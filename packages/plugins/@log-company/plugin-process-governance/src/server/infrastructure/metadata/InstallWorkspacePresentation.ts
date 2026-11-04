/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database, Transaction } from '@nocobase/database';
import { WORKSPACE_SHIPMENT_VIEW_UID } from '../../../shared/workspace';
import { ensureLogisticsWorkspacePage, LOGISTICS_WORKSPACE_ROUTE_UID } from './LogisticsWorkspacePage';
import {
  assignWorkspaceParents,
  workspaceColumn,
  workspaceHistory,
  workspaceSourceForm,
  RUN_FIELDS,
  SHIPMENT_GENERAL,
  SHIPMENT_CUSTOMS,
  SHIPMENT_NTM,
  type WorkspaceFlowTree,
} from './LogisticsWorkspaceNativeModels';
import { upgradeLogisticsWorkspace } from './UpgradeLogisticsWorkspace';
import { workspaceShipmentPageTree } from './WorkspaceShipmentPageTree';
import { workspaceAssociatedShipmentsTree } from './WorkspaceAssociatedShipmentsTree';
import { repairWorkspacePresentation } from './RepairWorkspacePresentation';
import { refineWorkspacePresentation } from './RefineWorkspacePresentation';
import { configureWorkspaceViewLoading } from './ConfigureWorkspaceViewLoading';
import { simplifyShipmentFields } from './SimplifyShipmentFields';

interface StoredModel {
  get(name: string): unknown;
}
interface Models {
  findOne(options: { filter: Record<string, unknown>; transaction: Transaction }): Promise<StoredModel | null>;
  upsertModel(
    node: Partial<WorkspaceFlowTree> & { uid: string },
    options: { transaction: Transaction },
  ): Promise<unknown>;
  remove(uid: string, options: { transaction: Transaction }): Promise<unknown>;
  attach(
    uid: string,
    target: { parentId: string; subKey: string; subType: 'array' | 'object'; position: 'last' },
    options: { transaction: Transaction },
  ): Promise<unknown>;
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

const DEFAULT_COLUMNS = [
  ['shipment_number', 'Поставка', 150],
  ['status', 'Статус', 140],
  ['chinese_client_name', 'Клиент', 120],
  ['invoice_number', 'Инвойс', 120],
  ['application_number', 'ЗВ', 110],
  ['declaration_number', 'ДТ', 220],
  ['customs_scheme', 'Схема', 100],
  ['ntm_certificate_goods', 'СС/ДС', 120],
  ['ntm_skk_goods', 'СКК', 110],
] as const;

export async function installWorkspacePresentation(db: Database): Promise<void> {
  await db.sequelize.transaction(async (transaction) => {
    await placeWorkspaceInInformation(db, transaction);
    await ensureLogisticsWorkspacePage(db, transaction);
    await upgradeLogisticsWorkspace(db, transaction);
    const models = db.getRepository('flowModels') as unknown as Models;
    async function save(tree: Partial<WorkspaceFlowTree> & { uid: string }) {
      await models.upsertModel(tree, { transaction });
      async function attach(node: Partial<WorkspaceFlowTree> & { uid: string }) {
        if (node.parentId && node.subKey && node.subType)
          await models.attach(
            node.uid,
            {
              parentId: node.parentId,
              subKey: node.subKey,
              subType: node.subType,
              position: 'last',
            },
            { transaction },
          );
        for (const children of Object.values(node.subModels || {})) {
          for (const child of Array.isArray(children) ? children : [children]) await attach(child);
        }
      }
      await attach(tree);
    }
    const table = await models.findOne({ filter: { uid: 'lclogworkspacetable' }, transaction });
    const tableOptions = object(table?.get('options'));
    const steps = object(tableOptions.stepParams);
    await save({
      uid: 'lclogworkspacetable',
      stepParams: {
        ...steps,
        tableSettings: {
          ...object(steps.tableSettings),
          showRowNumbers: { showIndex: false },
          tableDensity: { size: 'small' },
          defaultSorting: {
            sort: [
              { field: 'run_number', direction: 'asc' },
              { field: 'shipment_number', direction: 'asc' },
            ],
          },
        },
      },
    });
    await save({ uid: 'lclogworkspacepage', stepParams: { pageSettings: { general: { displayTitle: false } } } });
    for (const uid of [
      'lclogworkcol1',
      'lclogworkcol2',
      'lclogworkcol3',
      'lclogworkcol4',
      'lclogworkcol5',
      'lcwstransportcolumn',
    ]) {
      if (await models.findOne({ filter: { uid }, transaction })) await models.remove(uid, { transaction });
    }
    const currentColumns = await db
      .getRepository('flowModelTreePath')
      .find({ filter: { ancestor: 'lclogworkspacetable', depth: 1 }, transaction });
    for (const [index, definition] of DEFAULT_COLUMNS.entries()) {
      const [fieldPath, title, width] = definition;
      let existing: StoredModel | null = null;
      let uid = `lcwspresentationcol${index + 1}`;
      for (const path of currentColumns) {
        const candidate = await models.findOne({ filter: { uid: path.get('descendant') }, transaction });
        const options = object(candidate?.get('options'));
        if (object(object(object(options.stepParams).fieldSettings).init).fieldPath === fieldPath) {
          existing = candidate;
          uid = String(path.get('descendant'));
          break;
        }
      }
      const column = workspaceColumn(uid, 'logistics_work_items', fieldPath, fieldPath === 'shipment_number');
      if (existing) {
        const children = await db
          .getRepository('flowModelTreePath')
          .find({ filter: { ancestor: uid, depth: 1 }, transaction });
        for (const path of children) {
          const field = await models.findOne({ filter: { uid: path.get('descendant') }, transaction });
          const options = object(field?.get('options'));
          if (options.subKey === 'field' || (typeof options.use === 'string' && options.use.endsWith('FieldModel'))) {
            (column.subModels?.field as WorkspaceFlowTree).uid = String(path.get('descendant'));
            break;
          }
        }
      }
      column.parentId = 'lclogworkspacetable';
      column.subKey = 'columns';
      column.subType = 'array';
      const props = object(object(existing?.get('options')).props);
      column.props = { title, width, ...props, ...(fieldPath === 'shipment_number' ? { fixed: 'left' } : {}) };
      if (fieldPath === 'shipment_number') {
        const field = column.subModels?.field as WorkspaceFlowTree;
        field.stepParams = {
          displayFieldSettings: { clickToOpen: { clickToOpen: true } },
          popupSettings: {
            openView: {
              uid: WORKSPACE_SHIPMENT_VIEW_UID,
              mode: 'embed',
              navigation: false,
              dataSourceKey: 'main',
              collectionName: 'shipments',
            },
          },
        };
      }
      assignWorkspaceParents(column);
      await save(column);
    }
    await save({
      uid: 'lclogworkfilter',
      props: {
        position: 'left',
        iconOnly: true,
        icon: 'FilterOutlined',
        'aria-label': 'Фильтр',
        title: 'Фильтр',
        tooltip: 'Фильтр',
      },
    });
    await save({
      uid: 'lclogworksearch',
      props: {
        searchPlaceholder: 'Поиск по всем данным',
        searchableFieldNames: [
          'run_number',
          'registration_number',
          'manager_names',
          'declarant_names',
          'shipment_number',
          'chinese_client_name',
          'invoice_number',
          'application_number',
          'declaration_number',
          'status',
        ],
      },
    });
    await save({
      uid: 'lcwsrecordpopup',
      stepParams: {
        popupSettings: {
          openView: {
            mode: 'dialog',
            size: 'large',
            navigation: false,
            dataSourceKey: 'main',
            collectionName: 'logistics_work_items',
          },
        },
      },
    });
    // Remove the duplicate association input; the shipments tab owns creation and linking.
    const runFields = await db
      .getRepository('flowModelTreePath')
      .find({ filter: { ancestor: 'lcwsrunformgrid', depth: 1 }, transaction });
    for (const path of runFields) {
      const field = await models.findOne({ filter: { uid: path.get('descendant') }, transaction });
      const options = object(field?.get('options'));
      if (object(object(object(options.stepParams).fieldSettings).init).fieldPath === 'shipments')
        await models.remove(String(path.get('descendant')), { transaction });
    }
    const runForm = workspaceSourceForm('lcwsrunform', 'transport_runs', RUN_FIELDS);
    runForm.parentId = 'lcwsruncontextgrid';
    runForm.subKey = 'items';
    runForm.subType = 'array';
    assignWorkspaceParents(runForm);
    await save(runForm);
    await save({ uid: 'lcwsshipmentselector', props: { pageOnly: true } });
    for (const uid of ['lcwsrsname', 'lcwsrsstatus', 'lcwsrsclient']) {
      if (await models.findOne({ filter: { uid }, transaction })) await models.remove(uid, { transaction });
    }
    await save(workspaceAssociatedShipmentsTree());
    await save(workspaceShipmentPageTree());
    const sidebarTrees: WorkspaceFlowTree[] = [
      { uid: 'lcwssidetree', use: 'RunTreeBlockModel' },
      workspaceHistory('lcwssidehistory', 'run'),
    ];
    for (const tree of sidebarTrees) {
      tree.parentId = 'lcwsgroupedtable';
      tree.subKey = 'sidebarTemplates';
      tree.subType = 'array';
      assignWorkspaceParents(tree);
      await save(tree);
    }
    // A new shipment is anchored by the action's formData; its run is not an editable field.
    const createForm = workspaceSourceForm(
      'lcwscreateship',
      'shipments',
      [...SHIPMENT_GENERAL, ...SHIPMENT_CUSTOMS, ...SHIPMENT_NTM],
      true,
    );
    createForm.parentId = 'lcwsnewshipcontextgrid';
    createForm.subKey = 'items';
    createForm.subType = 'array';
    const oldRunField = await models.findOne({ filter: { uid: 'lcwscreateshipf1' }, transaction });
    if (object(object(object(object(oldRunField?.get('options')).stepParams).fieldSettings).init).fieldPath === 'runs')
      await models.remove('lcwscreateshipgrid', { transaction });
    assignWorkspaceParents(createForm);
    await save(createForm);
    await repairWorkspacePresentation(db, transaction);
    await refineWorkspacePresentation(db, transaction);
    await configureWorkspaceViewLoading(db, transaction);
    await simplifyShipmentFields(db, transaction);
  });
}

async function placeWorkspaceInInformation(db: Database, transaction: Transaction): Promise<void> {
  const routes = db.getRepository('desktopRoutes');
  let information = await routes.findOne({ filter: { type: 'group', title: 'Информация' }, transaction });
  if (!information)
    information = await routes.create({
      values: { type: 'group', title: 'Информация', schemaUid: 'lcinformation' },
      transaction,
    });
  let workspace = await routes.findOne({ filter: { schemaUid: LOGISTICS_WORKSPACE_ROUTE_UID }, transaction });
  const values = {
    parentId: information.get('id'),
    title: 'Рейсы и поставки',
    type: 'flowPage',
    hideInMenu: false,
    sort: 0,
    icon: null,
  };
  if (workspace) await routes.update({ filter: { schemaUid: LOGISTICS_WORKSPACE_ROUTE_UID }, values, transaction });
  else
    workspace = await routes.create({ values: { schemaUid: LOGISTICS_WORKSPACE_ROUTE_UID, ...values }, transaction });
  const grants = db.getRepository('rolesDesktopRoutes');
  const parentGrants = await grants.find({ filter: { desktopRouteId: information.get('id') }, transaction });
  const roles = new Set<string>(parentGrants.map((grant: StoredModel) => String(grant.get('roleName'))));
  for (const role of ['admin', 'manager', 'declarant', 'financier']) {
    if (await db.getRepository('roles').findOne({ filter: { name: role }, transaction })) roles.add(role);
  }
  for (const roleName of roles) {
    const permission = { desktopRouteId: workspace.get('id'), roleName };
    if (!(await grants.findOne({ filter: permission, transaction })))
      await grants.create({ values: permission, transaction });
  }
}
