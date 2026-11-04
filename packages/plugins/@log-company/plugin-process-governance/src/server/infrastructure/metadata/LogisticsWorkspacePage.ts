/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database, Transaction } from '@nocobase/database';
import { LOGISTICS_COLLECTIONS, LOGISTICS_STATUS_LABELS, LOGISTICS_STATUS_VALUES } from '../../../shared/logistics';

export const LOGISTICS_WORKSPACE_ROUTE_UID = 'lclogworkspace';
export const LOGISTICS_WORKSPACE_TAB_UID = 'lclogworkspacetab';
const WORKSPACE_PAGE_UID = 'lclogworkspacepage';
const WORKSPACE_GRID_UID = 'lclogworkspacegrid';
const WORKSPACE_TABLE_UID = 'lclogworkspacetable';
const WORKSPACE_ACTIONS_UID = 'lclogworkspaceactions';

const DEFAULT_COLUMNS = [
  { fieldPath: 'run_number', displayModel: 'DisplayNumberFieldModel' },
  { fieldPath: 'registration_number', displayModel: 'DisplayTextFieldModel' },
  { fieldPath: 'departure_city_name', displayModel: 'DisplayTextFieldModel' },
  { fieldPath: 'manager_names', displayModel: 'DisplayTextFieldModel' },
  { fieldPath: 'declarant_names', displayModel: 'DisplayTextFieldModel' },
  { fieldPath: 'shipment_number', displayModel: 'DisplayNumberFieldModel' },
  { fieldPath: 'chinese_client_name', displayModel: 'DisplayTextFieldModel' },
  { fieldPath: 'status', displayModel: 'DisplayEnumFieldModel' },
] as const;

interface ModelRecord {
  get(name: string): unknown;
}

interface FlowModelsRepository {
  findOne(options: { filter: Record<string, unknown>; transaction: Transaction }): Promise<ModelRecord | null>;
  upsertModel(node: FlowNode, options: { transaction: Transaction }): Promise<unknown>;
  attach(
    uid: string,
    options: { parentId: string; subKey: string; subType: 'array' | 'object'; position: 'last' },
    transactionOptions: { transaction: Transaction },
  ): Promise<unknown>;
}

interface UiSchemasRepository {
  findOne(options: { filter: Record<string, unknown>; transaction: Transaction }): Promise<ModelRecord | null>;
  insert(schema: Record<string, unknown>, options: { transaction: Transaction }): Promise<unknown>;
}

interface FlowNode {
  uid: string;
  parentId?: string;
  subKey?: string;
  subType?: 'array' | 'object';
  sortIndex?: number;
  use?: string;
  async?: boolean;
  props?: Record<string, unknown> | null;
  stepParams?: Record<string, unknown>;
}

/**
 * Creates the standard FlowEngine page instead of a fixed React page. Because
 * it is a regular TableBlockModel, the table-personalization plugin provides
 * the same «Мои колонки» UI as every other operational table.
 */
export async function ensureLogisticsWorkspacePage(db: Database, transaction?: Transaction): Promise<void> {
  if (transaction) return buildWorkspacePage(db, transaction);
  await db.sequelize.transaction(async (transaction) => {
    await buildWorkspacePage(db, transaction);
  });
}

async function buildWorkspacePage(db: Database, transaction: Transaction): Promise<void> {
  const route = await db.getRepository('desktopRoutes').findOne({
    filter: { schemaUid: LOGISTICS_WORKSPACE_ROUTE_UID },
    transaction,
  });
  if (!route) {
    throw new Error('Не найден маршрут общего рабочего списка.');
  }
  await ensureRouteEntrySchema(db, transaction);
  const routes = db.getRepository('desktopRoutes');
  const tab = await routes.findOne({ filter: { schemaUid: LOGISTICS_WORKSPACE_TAB_UID }, transaction });
  if (!tab) {
    await routes.create({
      transaction,
      values: {
        parentId: route.get('id'),
        schemaUid: LOGISTICS_WORKSPACE_TAB_UID,
        tabSchemaName: LOGISTICS_WORKSPACE_TAB_UID,
        type: 'tabs',
        title: 'Рабочий список',
        hidden: true,
        hideInMenu: false,
        sort: 1,
      },
    });
  }
  // Hidden default tabs inherit exactly the page's menu grants, including custom roles.
  const grants = await db.getRepository('rolesDesktopRoutes').find({
    filter: { desktopRouteId: route.get('id') },
    transaction,
  });
  const savedTab = tab || (await routes.findOne({ filter: { schemaUid: LOGISTICS_WORKSPACE_TAB_UID }, transaction }));
  const roleRoutes = db.getRepository('rolesDesktopRoutes');
  for (const grant of grants) {
    const values = { desktopRouteId: savedTab.get('id'), roleName: grant.get('roleName') };
    if (!(await roleRoutes.findOne({ filter: values, transaction }))) {
      await roleRoutes.create({ values, transaction });
    }
  }

  const createNode = (node: FlowNode) => createFlowNode(db, node, transaction);
  await createNode({ uid: LOGISTICS_WORKSPACE_ROUTE_UID, use: 'RouteModel' });
  await createNode({
    uid: WORKSPACE_PAGE_UID,
    parentId: LOGISTICS_WORKSPACE_ROUTE_UID,
    subKey: 'page',
    subType: 'object',
    use: 'RootPageModel',
  });
  await createNode({ uid: LOGISTICS_WORKSPACE_TAB_UID, use: 'RouteModel' });
  await createNode({
    uid: WORKSPACE_GRID_UID,
    parentId: LOGISTICS_WORKSPACE_TAB_UID,
    subKey: 'grid',
    subType: 'object',
    use: 'BlockGridModel',
    async: true,
    sortIndex: 0,
    stepParams: {},
  });
  await createNode({
    uid: WORKSPACE_TABLE_UID,
    parentId: WORKSPACE_GRID_UID,
    subKey: 'items',
    subType: 'array',
    use: 'TableBlockModel',
    sortIndex: 1,
    stepParams: {
      resourceSettings: {
        init: { dataSourceKey: 'main', collectionName: LOGISTICS_COLLECTIONS.workItems },
      },
      tableSettings: {
        quickEdit: { editable: false },
        showRowNumbers: { showIndex: true },
        tableDensity: { size: 'large' },
      },
    },
  });

  for (const [index, column] of DEFAULT_COLUMNS.entries()) {
    const columnUid = `lclogworkcol${index + 1}`;
    await createNode({
      uid: columnUid,
      parentId: WORKSPACE_TABLE_UID,
      subKey: 'columns',
      subType: 'array',
      use: 'TableColumnModel',
      sortIndex: index + 1,
      stepParams: {
        fieldSettings: {
          init: {
            dataSourceKey: 'main',
            collectionName: LOGISTICS_COLLECTIONS.workItems,
            fieldPath: column.fieldPath,
          },
        },
        tableColumnSettings: {
          model: { use: column.displayModel },
          quickEdit: { editable: false },
        },
      },
    });
    await createNode({
      uid: `lclogworkfield${index + 1}`,
      parentId: columnUid,
      subKey: 'field',
      subType: 'object',
      use: column.displayModel,
      sortIndex: 0,
      props:
        column.fieldPath === 'status'
          ? {
              options: LOGISTICS_STATUS_VALUES.map((value) => ({ value, label: LOGISTICS_STATUS_LABELS[value] })),
            }
          : null,
      stepParams: { displayFieldSettings: { clickToOpen: { clickToOpen: false } } },
    });
  }

  await createNode({
    uid: WORKSPACE_ACTIONS_UID,
    parentId: WORKSPACE_TABLE_UID,
    subKey: 'columns',
    subType: 'array',
    use: 'TableActionsColumnModel',
    sortIndex: DEFAULT_COLUMNS.length + 1,
    props: { title: 'Действия', width: 250, fixed: 'right' },
    stepParams: {},
  });
  await createRecordActions(createNode);
  await createCollectionActions(createNode);
}

async function ensureRouteEntrySchema(db: Database, transaction: Transaction): Promise<void> {
  const schemas = db.getRepository('uiSchemas') as unknown as UiSchemasRepository;
  const existing = await schemas.findOne({ filter: { 'x-uid': LOGISTICS_WORKSPACE_ROUTE_UID }, transaction });
  if (existing) {
    return;
  }
  // The desktop shell always loads uiSchemas:getJsonSchema before it can
  // mount FlowEngine. A flowPage route and its FlowModels alone are not enough.
  // Match getFlowPageMenuSchema() from the native modern-page initializer.
  await schemas.insert(
    { type: 'void', 'x-component': 'FlowRoute', 'x-uid': LOGISTICS_WORKSPACE_ROUTE_UID },
    { transaction },
  );
}

async function createRecordActions(createNode: (node: FlowNode) => Promise<void>): Promise<void> {
  const actions = [
    { uid: 'lclogworkrun', use: 'LogisticsWorkspaceRunActionModel', title: 'Рейс' },
    { uid: 'lclogworklinks', use: 'LogisticsWorkspaceLinksActionModel', title: 'Поставки' },
    { uid: 'lclogworkshipment', use: 'LogisticsWorkspaceShipmentActionModel', title: 'Поставка' },
    { uid: 'lclogworkdelete', use: 'LogisticsWorkspaceDeleteRunActionModel', title: 'Удалить' },
  ] as const;
  for (const [index, action] of actions.entries()) {
    await createNode({
      uid: action.uid,
      parentId: WORKSPACE_ACTIONS_UID,
      subKey: 'actions',
      subType: 'array',
      use: action.use,
      sortIndex: index + 1,
      props: {
        title: action.title,
        type: 'link',
        danger: action.use === 'LogisticsWorkspaceDeleteRunActionModel',
      },
      stepParams: {},
    });
  }
}

async function createCollectionActions(createNode: (node: FlowNode) => Promise<void>): Promise<void> {
  const actions = [
    {
      uid: 'lclogworksearch',
      use: 'CollectionSearchActionModel',
      props: {
        searchPlaceholder: 'Машина, рейс, поставка, клиент, ДТ',
        searchableFieldNames: [
          'run_number',
          'registration_number',
          'manager_names',
          'declarant_names',
          'shipment_number',
          'chinese_client_name',
          'declaration_number',
        ],
      },
    },
    { uid: 'lclogworkfilter', use: 'FilterActionModel', props: {} },
    {
      uid: 'lclogworknewrun',
      use: 'LogisticsWorkspaceNewRunActionModel',
      props: { title: 'Новый рейс', type: 'primary', icon: 'PlusOutlined' },
    },
  ] as const;
  for (const [index, action] of actions.entries()) {
    await createNode({
      uid: action.uid,
      parentId: WORKSPACE_TABLE_UID,
      subKey: 'actions',
      subType: 'array',
      use: action.use,
      sortIndex: index + 1,
      props: action.props,
      stepParams: {},
    });
  }
}

async function createFlowNode(db: Database, node: FlowNode, transaction: Transaction): Promise<void> {
  const models = db.getRepository('flowModels') as unknown as FlowModelsRepository;
  const existing = await models.findOne({ filter: { uid: node.uid }, transaction });
  if (!existing) {
    await models.upsertModel(node, { transaction });
    return;
  }
  if (!node.parentId || !node.subKey || !node.subType) {
    return;
  }
  const parentPath = await db.getRepository('flowModelTreePath').findOne({
    filter: { descendant: node.uid, depth: 1 },
    transaction,
  });
  // Repair orphan nodes left by repository.create(), preserving saved props,
  // column order and other designer settings on already attached models.
  if (
    !parentPath ||
    (node.uid === WORKSPACE_GRID_UID && parentPath.get('ancestor') === LOGISTICS_WORKSPACE_ROUTE_UID)
  ) {
    await models.attach(
      node.uid,
      { parentId: node.parentId, subKey: node.subKey, subType: node.subType, position: 'last' },
      { transaction },
    );
  }
}
