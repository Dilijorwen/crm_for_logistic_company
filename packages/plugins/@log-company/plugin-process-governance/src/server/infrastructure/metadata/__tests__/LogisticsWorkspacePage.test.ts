/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createMockDatabase, type Database } from '@nocobase/database';
import flowModels from '../../../../../../../@nocobase/plugin-flow-engine/src/server/collections/flowModels';
import flowModelTreePath from '../../../../../../../@nocobase/plugin-flow-engine/src/server/collections/flowModelTreePath';
import { FlowSchemaModel } from '../../../../../../../@nocobase/plugin-flow-engine/src/server/model';
import FlowModelRepository from '../../../../../../../@nocobase/plugin-flow-engine/src/server/repository';
import uiSchemas from '../../../../../../../@nocobase/plugin-ui-schema-storage/src/server/collections/uiSchemas';
import uiSchemaTreePath from '../../../../../../../@nocobase/plugin-ui-schema-storage/src/server/collections/uiSchemaTreePath';
import uiSchemaServerHooks from '../../../../../../../@nocobase/plugin-ui-schema-storage/src/server/collections/uiSchemaServerHooks';
import { UiSchemaModel } from '../../../../../../../@nocobase/plugin-ui-schema-storage/src/server/model';
import { ServerHookModel } from '../../../../../../../@nocobase/plugin-ui-schema-storage/src/server/server-hooks/model';
import UiSchemaRepository from '../../../../../../../@nocobase/plugin-ui-schema-storage/src/server/repository';
import RepairWorkspaceForms from '../../../migrations/20261030003000-repair-workspace-popup-and-forms';
import ConfigureUnifiedWorkspace from '../../../migrations/20261118020000-configure-unified-logistics-workspace';
import RegisterDeclarantComment from '../../../migrations/20261118030000-register-declarant-comment-field';
import RefineUnifiedShipmentForm from '../../../migrations/20261118040000-refine-unified-shipment-form';
import ConsolidateRunEditor from '../../../migrations/20261118050000-consolidate-run-editor';
import UseUnifiedDocumentsForRuns from '../../../migrations/20261118060000-use-unified-documents-for-runs';
import ConfigureWorkspaceSelectorScopes from '../../../migrations/20261119020000-configure-workspace-selector-scopes';
import ScopeWorkspaceCustomsWarehouses from '../../../migrations/20261119021000-scope-workspace-customs-warehouses';
import UseCombinedWorkspaceHistory from '../../../migrations/20261121020000-use-combined-workspace-history';
import ConfigureSharedWorkspaceDiscussion from '../../../migrations/20261121021000-configure-shared-workspace-discussion';
import PersonalizeShipmentPickers from '../../../migrations/20261122010000-personalize-workspace-shipment-pickers';
import SwapUnifiedFormColumns from '../../../migrations/20261123010000-swap-unified-form-columns';
import { upgradeLogisticsWorkspace } from '../UpgradeLogisticsWorkspace';
import { WORKSPACE_RECORD_POPUP_UID, type WorkspaceFlowTree } from '../LogisticsWorkspaceNativeModels';
import { installWorkspacePresentation } from '../InstallWorkspacePresentation';
import { repairWorkspacePresentation } from '../RepairWorkspacePresentation';
import { configureWorkspaceViewLoading } from '../ConfigureWorkspaceViewLoading';
import { refineWorkspacePresentation } from '../RefineWorkspacePresentation';
import { WORKSPACE_SHIPMENT_VIEW_UID } from '../../../../shared/workspace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensureLogisticsWorkspacePage,
  LOGISTICS_WORKSPACE_ROUTE_UID,
  LOGISTICS_WORKSPACE_TAB_UID,
} from '../LogisticsWorkspacePage';

describe('logistics workspace with the real FlowModelRepository', () => {
  let db: Database;
  let models: FlowModelRepository;

  function fullModel(uid: string) {
    return models.findModelById(uid, { includeAsyncNode: true });
  }

  beforeEach(async () => {
    db = await createMockDatabase({ dialect: 'sqlite', storage: ':memory:' });
    db.registerModels({ FlowSchemaModel, UiSchemaModel, ServerHookModel });
    db.registerRepositories({ FlowModelRepository, UiSchemaRepository });
    db.collection({ name: 'roles', autoGenId: false, fields: [{ type: 'string', name: 'name', primaryKey: true }] });
    db.collection(uiSchemaServerHooks);
    db.collection(uiSchemas);
    db.collection(uiSchemaTreePath);
    db.collection(flowModels);
    db.collection(flowModelTreePath);
    db.collection({
      name: 'desktopRoutes',
      fields: [
        { type: 'string', name: 'schemaUid', unique: true },
        { type: 'string', name: 'parentId' },
        { type: 'string', name: 'title' },
        { type: 'string', name: 'type' },
        { type: 'string', name: 'icon' },
        { type: 'string', name: 'tabSchemaName' },
        { type: 'boolean', name: 'hidden' },
        { type: 'boolean', name: 'hideInMenu' },
        { type: 'integer', name: 'sort' },
      ],
    });
    db.collection({
      name: 'rolesDesktopRoutes',
      fields: [
        { type: 'string', name: 'desktopRouteId' },
        { type: 'string', name: 'roleName' },
      ],
    });
    await db.sync();
    models = db.getRepository('flowModels') as FlowModelRepository;
    const route = await db.getRepository('desktopRoutes').create({
      values: { schemaUid: LOGISTICS_WORKSPACE_ROUTE_UID, type: 'flowPage' },
    });
    await db.getRepository('rolesDesktopRoutes').create({
      values: { desktopRouteId: route.get('id'), roleName: 'custom-role' },
    });
  });

  afterEach(async () => {
    await db.close();
  });

  it('loads the page and table through the same parent queries as the client', async () => {
    await ensureLogisticsWorkspacePage(db);
    const schemas = db.getRepository('uiSchemas') as UiSchemaRepository;
    // This is the shell's first request, before any FlowModel requests occur.
    const entry = await schemas.getJsonSchema(LOGISTICS_WORKSPACE_ROUTE_UID);
    expect(entry).toMatchObject({
      type: 'void',
      'x-component': 'FlowRoute',
      'x-uid': LOGISTICS_WORKSPACE_ROUTE_UID,
    });
    const page = await models.findModelByParentId(LOGISTICS_WORKSPACE_ROUTE_UID, { subKey: 'page' });
    expect(page.use).toBe('RootPageModel');
    const grid = await models.findModelByParentId(LOGISTICS_WORKSPACE_TAB_UID, { subKey: 'grid' });
    const table = grid.subModels.items[0];
    expect(table).toMatchObject({
      use: 'TableBlockModel',
      stepParams: { resourceSettings: { init: { collectionName: 'logistics_work_items' } } },
    });
    expect(table.subModels.columns).toHaveLength(9);
    expect(table.subModels.columns[0].subModels.field.use).toBe('DisplayNumberFieldModel');
    expect(table.subModels.actions.map((action: { use: string }) => action.use)).toEqual([
      'CollectionSearchActionModel',
      'FilterActionModel',
      'LogisticsWorkspaceNewRunActionModel',
    ]);
    const tab = await db.getRepository('desktopRoutes').findOne({ filter: { schemaUid: LOGISTICS_WORKSPACE_TAB_UID } });
    expect(
      await db.getRepository('rolesDesktopRoutes').count({
        filter: { desktopRouteId: tab.get('id'), roleName: 'custom-role' },
      }),
    ).toBe(1);
  });

  it('adds one native shipment subform to each run editor and preserves the configured table actions', async () => {
    await installWorkspacePresentation(db);
    const table = await fullModel('lclogworkspacetable');
    const migration = new ConfigureUnifiedWorkspace({ db } as ConstructorParameters<
      typeof ConfigureUnifiedWorkspace
    >[0]);
    await migration.up();
    await migration.up();
    const actions = (await fullModel('lclogworkspacetable')).subModels.actions;
    const toolbarSettings = (original: WorkspaceFlowTree[]) =>
      original
        .filter((action) => action.uid !== 'lcwsdeleteshipment')
        .map(({ uid, use, props, stepParams }) => ({ uid, use, props, stepParams }));
    expect(toolbarSettings(actions)).toEqual(toolbarSettings(table.subModels.actions));
    expect(actions.find((action) => action.uid === 'lcwsdeleteshipment').props.iconOnly).toBe(true);
    for (const uid of ['lcwscreaterun', 'lcwsrunform']) {
      const form = await fullModel(uid);
      expect(form.props.workspaceUnified).toBe(true);
      expect(form.subModels.actions).toHaveLength(1);
      const grid = form.subModels.grid;
      const subform = grid.subModels.items.find((item: WorkspaceFlowTree) => item.uid === `${uid}unifiedshipment`);
      expect(grid.stepParams.gridSettings.grid.rows.details[1]).toEqual([subform.uid]);
      expect(subform.stepParams.fieldSettings.init.fieldPath).toBe('shipments');
      expect(subform.subModels.field.use).toBe('LogisticsWorkspaceShipmentSubformModel');
      const fields = subform.subModels.field.subModels.grid.subModels.items;
      const paths = fields.map((item) => item.stepParams.fieldSettings.init.fieldPath);
      expect(paths.slice(0, 5)).toEqual([
        'shipments.status',
        'shipments.chinese_client',
        'shipments.customs_scheme',
        'shipments.company',
        'shipments.contract_record',
      ]);
      expect(paths.includes('shipments.customs_warehouse_storage_date')).toBe(uid === 'lcwsrunform');
      expect(paths.includes('shipments.declarant_comment')).toBe(uid === 'lcwsrunform');
      expect(paths.includes('shipments.ntm_honest_sign_goods')).toBe(uid === 'lcwsrunform');
    }
  });

  it('scopes native selectors across run and shipment forms while preserving other field settings', async () => {
    await installWorkspacePresentation(db);
    await new ConfigureUnifiedWorkspace({ db } as ConstructorParameters<typeof ConfigureUnifiedWorkspace>[0]).up();
    const filter = (field: WorkspaceFlowTree) => field.stepParams?.selectSettings;
    const existing = await fullModel('lcwscreaterununifiedshipmentdetailsf2input');
    const original = existing.stepParams.selectSettings;
    const other = { path: 'name', operator: '$ne', value: 'Скрыто' };
    await models.upsertModel({
      uid: existing.uid,
      stepParams: {
        ...existing.stepParams,
        selectSettings: { ...original, dataScope: { filter: { logic: '$and', items: [other] } } },
      },
    });
    const migration = new ConfigureWorkspaceSelectorScopes({ db } as ConstructorParameters<
      typeof ConfigureWorkspaceSelectorScopes
    >[0]);
    await migration.up();
    await migration.up();
    const active = { path: 'is_active', operator: '$isTruly', value: true, noValue: true };
    for (const uid of ['lcwscreaterun', 'lcwsrunform']) {
      expect(filter(await fullModel(`${uid}f5input`))).toMatchObject({
        dataScope: { filter: { logic: '$and', items: [{ path: 'roles.title', operator: '$eq', value: 'Декларант' }] } },
      });
      expect(filter(await fullModel(`${uid}unifiedshipmentdetailsf4input`))).toMatchObject({
        dataScope: { filter: { logic: '$and', items: [active] } },
      });
      expect(filter(await fullModel(`${uid}unifiedshipmentdetailsf5input`))).toMatchObject({
        dataScope: {
          filter: {
            logic: '$and',
            items: [
              { path: 'importers.id', operator: '$eq', value: '{{ ctx.item.value.company.id }}' },
              { path: 'importers.id', operator: '$notEmpty', value: true },
              active,
            ],
          },
        },
      });
    }
    expect(filter(await fullModel(existing.uid))).toMatchObject({
      allowMultiple: { allowMultiple: true },
      dataScope: { filter: { logic: '$and', items: [active, other] } },
    });
    for (const uid of ['lcwscreateship', 'lcwspagegeneral']) {
      expect(filter(await fullModel(`${uid}f1input`))).toMatchObject({ dataScope: { filter: { items: [active] } } });
      const contract = await fullModel(`${uid}f6input`);
      expect(contract.use).toBe('LogisticsWorkspaceScopedSelectFieldModel');
      expect(filter(contract)).toMatchObject({
        dataScope: {
          filter: {
            items: [
              { path: 'importers.id', operator: '$eq', value: '{{ ctx.formValues.company.id }}' },
              { path: 'importers.id', operator: '$notEmpty', value: true },
              active,
            ],
          },
        },
      });
    }
  });

  it('uses the active-record scope for the native warehouse selectors', async () => {
    await installWorkspacePresentation(db);
    await new ConfigureUnifiedWorkspace({ db } as ConstructorParameters<typeof ConfigureUnifiedWorkspace>[0]).up();
    const importerUid = 'lcwscreaterununifiedshipmentdetailsf4input';
    const existingImporter = await fullModel(importerUid);
    const uids = [
      'lcwscreaterununifiedshipmentdetailsf6',
      'lcwsrunformunifiedshipmentdetailsf6',
      'lcwscreateshipf8',
      'lcwspagecustomsf2',
    ];
    const migration = new ScopeWorkspaceCustomsWarehouses({ db } as ConstructorParameters<
      typeof ScopeWorkspaceCustomsWarehouses
    >[0]);
    await migration.up();
    await migration.up();
    expect(await fullModel(importerUid)).toEqual(existingImporter);
    for (const uid of uids) {
      expect(await fullModel(`${uid}input`)).toMatchObject({
        use: 'LogisticsWorkspaceScopedSelectFieldModel',
        stepParams: {
          selectSettings: {
            dataScope: { filter: { items: [{ path: 'is_active', operator: '$isTruly', value: true, noValue: true }] } },
          },
        },
      });
    }
  });

  it('registers the declarant comment in the designer only once', async () => {
    db.collection({
      name: 'fields',
      fields: [
        { name: 'key', type: 'string', unique: true },
        { name: 'collectionName', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'type', type: 'string' },
        { name: 'interface', type: 'string' },
        { name: 'options', type: 'json' },
      ],
    });
    await db.sync();
    const migration = new RegisterDeclarantComment({ db } as ConstructorParameters<typeof RegisterDeclarantComment>[0]);
    await migration.up();
    await migration.up();
    const fields = await db.getRepository('fields').find({ filter: { collectionName: 'shipments' } });
    expect(fields).toHaveLength(1);
    expect(fields[0].toJSON()).toMatchObject({
      name: 'declarant_comment',
      type: 'text',
      interface: 'textarea',
      options: { uiSchema: { title: 'Комментарий декларанта' } },
    });
  });

  it('puts shipments before run fields in both unified forms and preserves widths and documents', async () => {
    await installWorkspacePresentation(db);
    await new ConfigureUnifiedWorkspace({ db } as ConstructorParameters<typeof ConfigureUnifiedWorkspace>[0]).up();
    await new ConsolidateRunEditor({ db } as ConstructorParameters<typeof ConsolidateRunEditor>[0]).up();

    const edit = await fullModel('lcwsrunformgrid');
    const [runItems, shipmentItems] = edit.stepParams.gridSettings.grid.rows.details;
    const runCell = { id: 'run', rows: [{ id: 'nested', cells: [{ id: 'fields', items: runItems }] }] };
    const shipmentCell = { id: 'shipments', items: shipmentItems };
    const savedLayout = { version: 2, rows: [{ id: 'details', cells: [runCell, shipmentCell], sizes: [9, 15] }] };
    await models.upsertModel({
      uid: edit.uid,
      stepParams: {
        ...edit.stepParams,
        gridSettings: { grid: { ...edit.stepParams.gridSettings.grid, layout: savedLayout } },
      },
      props: { layout: savedLayout },
    });

    const migration = new SwapUnifiedFormColumns({ db } as ConstructorParameters<typeof SwapUnifiedFormColumns>[0]);
    await migration.up();
    await migration.up();

    for (const formUid of ['lcwscreaterun', 'lcwsrunform']) {
      const grid = await fullModel(`${formUid}grid`);
      const layout = grid.stepParams.gridSettings.grid;
      expect(layout.rows.details[0]).toEqual([`${formUid}unifiedshipment`]);
      expect(layout.rows.details[1]).toContain(`${formUid}griddocuments`);
      expect(layout.sizes.details).toEqual([14, 10]);
    }
    const updated = await fullModel(edit.uid);
    const expected = { version: 2, rows: [{ id: 'details', cells: [shipmentCell, runCell], sizes: [15, 9] }] };
    expect(updated.stepParams.gridSettings.grid.layout).toEqual(expected);
    expect(updated.props.layout).toEqual(expected);
    expect(updated.subModels).toEqual(edit.subModels);
  });

  it('enables column settings on existing shipment pickers without changing saved table columns', async () => {
    await installWorkspacePresentation(db);
    const uid = 'lcwsrsassoselecttable';
    await models.upsertModel({ uid, props: { oldSetting: true } });
    const before = await fullModel(uid);
    const migration = new PersonalizeShipmentPickers({ db } as ConstructorParameters<
      typeof PersonalizeShipmentPickers
    >[0]);
    await migration.up();
    await migration.up();

    const picker = await fullModel(uid);
    expect(picker.props).toEqual({ oldSetting: true, personalizeColumns: true });
    expect(picker.subModels).toEqual(before.subModels);
    expect(picker.stepParams).toEqual(before.stepParams);
  });

  it('installs the common discussion once and converts the existing history block in place', async () => {
    await installWorkspacePresentation(db);
    await models.upsertModel({ uid: 'lcwsrunhistorytable', use: 'TableBlockModel' });
    await models.remove('lcwsrundiscussiontab');
    const history = new UseCombinedWorkspaceHistory({ db } as ConstructorParameters<
      typeof UseCombinedWorkspaceHistory
    >[0]);
    const discussion = new ConfigureSharedWorkspaceDiscussion({ db } as ConstructorParameters<
      typeof ConfigureSharedWorkspaceDiscussion
    >[0]);
    await history.up();
    await discussion.up();
    await discussion.up();
    expect(await fullModel('lcwsrunhistorytable')).toMatchObject({ use: 'LogisticsWorkspaceHistoryBlockModel' });
    expect(await fullModel('lcwsrundiscussion')).toMatchObject({
      parentId: 'lcwsrundiscussiontabgrid',
      props: { workspaceDiscussion: 'run' },
    });
    expect(await fullModel('lcwspagediscussion')).toMatchObject({ props: { workspaceDiscussion: 'shipment' } });
    const page = await fullModel('lcwsrecordpage');
    expect(page.subModels.tabs.filter((tab: WorkspaceFlowTree) => tab.uid === 'lcwsrundiscussiontab')).toHaveLength(1);
  });

  it('puts run documents below the run fields and retires the separate shipment tab without losing its saved selector', async () => {
    await installWorkspacePresentation(db);
    await new ConfigureUnifiedWorkspace({ db } as ConstructorParameters<typeof ConfigureUnifiedWorkspace>[0]).up();
    const migration = new ConsolidateRunEditor({ db } as ConstructorParameters<typeof ConsolidateRunEditor>[0]);
    await migration.up();
    await migration.up();
    const page = await fullModel('lcwsrecordpage');
    expect(page.subModels.tabs.map((tab: WorkspaceFlowTree) => tab.uid)).toEqual([
      'lcwsruntab',
      'lcwsruntreetab',
      'lcwsrunhistorytab',
      'lcwsrundiscussiontab',
    ]);
    expect((await fullModel('lcwsrsassociate')).use).toBe('LogisticsWorkspaceAssociateActionModel');
    for (const uid of ['lcwsrunformgrid', 'lcwscreaterungrid']) {
      const grid = await fullModel(uid);
      const docsId = `${uid}documents`;
      expect(grid.stepParams.gridSettings.grid.rows.details[0].at(-1)).toBe(docsId);
      expect(grid.subModels.items.filter((item: WorkspaceFlowTree) => item.uid === docsId)).toMatchObject([
        {
          use: 'LogisticsWorkspaceRunDocumentsModel',
          subModels: {
            files: {
              use: 'CompanyFilesBlockModel',
              props: { source: 'auto' },
              decoratorProps: { title: 'Документы рейса' },
            },
          },
        },
      ]);
    }
    const unifiedDocuments = new UseUnifiedDocumentsForRuns({ db } as ConstructorParameters<
      typeof UseUnifiedDocumentsForRuns
    >[0]);
    await unifiedDocuments.up();
    await unifiedDocuments.up();
    for (const uid of ['lcwsrunformgrid', 'lcwscreaterungrid']) {
      const wrapper = await fullModel(`${uid}documents`);
      expect(wrapper.subModels.files).toMatchObject({
        uid: `${uid}documentsfiles`,
        use: 'ProcessDocumentsBlockModel',
        decoratorProps: { title: 'Документы рейса' },
      });
    }
    expect((await fullModel('lcwspagedocs')).use).toBe('ProcessDocumentsBlockModel');
  });

  it('configures a native picker and moves invoice, customs and NTM fields into their original editors', async () => {
    await installWorkspacePresentation(db);
    await new ConfigureUnifiedWorkspace({ db } as ConstructorParameters<typeof ConfigureUnifiedWorkspace>[0]).up();
    const migration = new RefineUnifiedShipmentForm({ db } as ConstructorParameters<
      typeof RefineUnifiedShipmentForm
    >[0]);
    const editUid = 'lcwsrunformunifiedshipmentfield';
    const before = (await fullModel(editUid)).subModels.grid.subModels.items as WorkspaceFlowTree[];
    await migration.up();
    await migration.up();
    const button = await fullModel('lcwsadd');
    expect(button.stepParams.buttonSettings.general).toMatchObject({ title: 'Добавить процесс', icon: 'PlusOutlined' });
    for (const uid of ['lcwscreaterununifiedshipmentfield', editUid]) {
      const field = await fullModel(uid);
      expect(field.stepParams.selectExitRecordSettings.openView).toEqual({ mode: 'dialog', size: 'large' });
      const selector = field.subModels['grid-block'].subModels.items[0];
      expect(selector.use).toBe('TableSelectModel');
      expect(selector.stepParams.resourceSettings.init).toEqual({ dataSourceKey: 'main', collectionName: 'shipments' });
      expect(
        selector.subModels.columns.some((column) => column.stepParams.fieldSettings.init.fieldPath === 'company.name'),
      ).toBe(true);
    }
    const after = (await fullModel(editUid)).subModels.grid.subModels.items as WorkspaceFlowTree[];
    const sections = after.filter((item) => item.use === 'LogisticsWorkspaceShipmentFoldGridModel');
    expect(sections.map((item) => item.props.workspaceSectionTitle)).toEqual([
      'Инвойс и товары',
      'Таможенное оформление',
      'НТМ',
    ]);
    const nested = sections.flatMap((section) => section.subModels.items as WorkspaceFlowTree[]);
    expect([...after.filter((item) => !sections.includes(item)), ...nested].map((item) => item.uid).sort()).toEqual(
      before.map((item) => item.uid).sort(),
    );
    for (const uid of ['lclogworkspacetable', 'lcwsrunshipments']) {
      const table = await fullModel(uid);
      const column = table.subModels.columns.find(
        (item) => item.stepParams.fieldSettings?.init?.fieldPath === 'shipment_number',
      );
      expect(column.subModels.field.stepParams.displayFieldSettings.clickToOpen.clickToOpen).toBe(false);
    }
  });

  it('repairs orphaned metadata from the earlier migration without losing settings', async () => {
    await models.upsertModel({ uid: LOGISTICS_WORKSPACE_ROUTE_UID, use: 'RouteModel' });
    await models.upsertModel({ uid: 'lclogworkspacegrid', use: 'BlockGridModel' });
    await models.upsertModel({
      uid: 'lclogworkspacetable',
      use: 'TableBlockModel',
      props: { title: 'Моя рабочая таблица' },
    });
    await models.upsertModel({ uid: 'lclogworkcol1', use: 'TableColumnModel', props: { width: 312 } });
    await ensureLogisticsWorkspacePage(db);
    const grid = await models.findModelByParentId(LOGISTICS_WORKSPACE_TAB_UID, { subKey: 'grid' });
    expect(grid.subModels.items[0].props.title).toBe('Моя рабочая таблица');
    expect(grid.subModels.items[0].subModels.columns[0].props.width).toBe(312);
    expect(grid.subModels.items[0].subModels.columns).toHaveLength(9);
  });

  it('is idempotent and preserves designer column order and settings', async () => {
    await ensureLogisticsWorkspacePage(db);
    await models.upsertModel({ uid: 'lclogworkcol1', props: { width: 320 } });
    await models.attach('lclogworkcol2', {
      parentId: 'lclogworkspacetable',
      subKey: 'columns',
      subType: 'array',
      position: 'first',
    });
    await ensureLogisticsWorkspacePage(db);
    const table = await fullModel('lclogworkspacetable');
    expect(table.subModels.columns[0].uid).toBe('lclogworkcol2');
    expect(table.subModels.columns[1].props.width).toBe(320);
    expect(await db.getRepository('desktopRoutes').count({ filter: { type: 'tabs' } })).toBe(1);
    expect(await db.getRepository('flowModels').count()).toBe(29);
    expect(await db.getRepository('uiSchemas').count()).toBe(1);
  });

  it('rolls back the entire page if model persistence fails', async () => {
    const save = vi.spyOn(models, 'upsertModel').mockRejectedValueOnce(new Error('persistence unavailable'));
    await expect(ensureLogisticsWorkspacePage(db)).rejects.toThrow('persistence unavailable');
    expect(await db.getRepository('desktopRoutes').count({ filter: { type: 'tabs' } })).toBe(0);
    expect(await db.getRepository('flowModels').count()).toBe(0);
    expect(await db.getRepository('uiSchemas').count()).toBe(0);
    save.mockRestore();
  });

  it('restores the route entry when the entire FlowModel tree already exists', async () => {
    await ensureLogisticsWorkspacePage(db);
    const schemas = db.getRepository('uiSchemas') as UiSchemaRepository;
    await schemas.remove(LOGISTICS_WORKSPACE_ROUTE_UID);
    expect(await schemas.getJsonSchema(LOGISTICS_WORKSPACE_ROUTE_UID)).toEqual({});
    // Reproduce the deployed regression: a valid FlowModel tree behind an empty desktop shell.
    expect(await models.findModelByParentId(LOGISTICS_WORKSPACE_TAB_UID, { subKey: 'grid' })).toBeTruthy();
    await ensureLogisticsWorkspacePage(db);
    expect(await schemas.getJsonSchema(LOGISTICS_WORKSPACE_ROUTE_UID)).toMatchObject({ 'x-component': 'FlowRoute' });
  });

  it('repairs the visible transport selector in saved layouts and removes only the workspace refresh button', async () => {
    await ensureLogisticsWorkspacePage(db);
    await models.upsertModel({
      uid: 'lcwsrefresh',
      use: 'RefreshActionModel',
      parentId: 'lclogworkspacetable',
      subKey: 'actions',
      subType: 'array',
    });
    await models.upsertModel({
      uid: 'designer-refresh',
      use: 'RefreshActionModel',
      parentId: 'lclogworkspacetable',
      subKey: 'actions',
      subType: 'array',
    });
    const originalRow = {
      id: 'registration-row',
      cells: [{ id: 'registration-cell', items: ['registration-field'] }],
      sizes: [24],
    };
    await models.upsertModel({
      uid: 'legacy-create',
      use: 'CreateFormModel',
      stepParams: { resourceSettings: { init: { collectionName: 'transport_runs' } } },
      subModels: {
        grid: {
          uid: 'legacy-grid',
          use: 'FormGridModel',
          stepParams: { gridSettings: { grid: { layout: { version: 2, rows: [originalRow] } } } },
          subModels: {
            items: [
              {
                uid: 'registration-field',
                use: 'FormItemModel',
                stepParams: {
                  fieldSettings: { init: { collectionName: 'transport_runs', fieldPath: 'registration_number_input' } },
                },
              },
              {
                uid: 'existing-mode',
                use: 'FormItemModel',
                stepParams: {
                  fieldSettings: { init: { collectionName: 'transport_runs', fieldPath: 'transport_type' } },
                },
                subModels: { field: { uid: 'existing-mode-input', use: 'InputFieldModel' } },
              },
            ],
          },
        },
      },
    });
    const migration = new RepairWorkspaceForms({ db } as ConstructorParameters<typeof RepairWorkspaceForms>[0]);
    await migration.up();
    await migration.up();
    const grid = await fullModel('legacy-grid');
    expect(grid.stepParams.gridSettings.grid.layout.rows).toEqual([
      {
        id: 'legacy-gridtransportType',
        cells: [{ id: 'legacy-gridtransportType:cell:0', items: ['existing-mode'] }],
        sizes: [24],
      },
      originalRow,
    ]);
    const field = await fullModel('existing-mode');
    expect(field.stepParams.editItemSettings.required.required).toBe(true);
    expect(field.subModels.field.use).toBe('SelectFieldModel');
    expect(await models.findOne({ filter: { uid: 'lcwsrefresh' } })).toBeNull();
    expect(await models.findOne({ filter: { uid: 'designer-refresh' } })).not.toBeNull();
  });

  it('adds the transport selector to legacy row layouts without hiding existing fields', async () => {
    await models.upsertModel({
      uid: 'legacy-edit',
      use: 'EditFormModel',
      stepParams: { resourceSettings: { init: { collectionName: 'transport_runs' } } },
      subModels: {
        grid: {
          uid: 'edit-grid',
          use: 'FormGridModel',
          stepParams: { gridSettings: { grid: { rows: { original: [['old-field']] }, sizes: { original: [24] } } } },
          subModels: { items: [{ uid: 'old-field', use: 'FormItemModel' }] },
        },
      },
    });
    const migration = new RepairWorkspaceForms({ db } as ConstructorParameters<typeof RepairWorkspaceForms>[0]);
    await migration.up();
    await migration.up();
    const grid = await fullModel('edit-grid');
    expect(grid.stepParams.gridSettings.grid.rows).toEqual({
      'edit-gridtransportType': [['lcmodelegacy-edit']],
      original: [['old-field']],
    });
    expect(grid.subModels.items).toHaveLength(2);
    expect((await fullModel('lcmodelegacy-edit')).subModels.field.use).toBe('SelectFieldModel');
  });

  it('upgrades to source-bound native forms, designer popups and compact toolbar actions', async () => {
    await ensureLogisticsWorkspacePage(db);
    await upgradeLogisticsWorkspace(db);
    await upgradeLogisticsWorkspace(db);
    const table = await fullModel('lclogworkspacetable');
    expect(table.stepParams.tableSettings.tableDensity.size).toBe('small');
    expect(table.subModels.actions.some((action: { uid: string }) => action.uid === 'lcwsrefresh')).toBe(false);
    expect(table.subModels.columns).toHaveLength(9);
    expect(table.subModels.columns[1].subModels.field).toMatchObject({
      use: 'LogisticsWorkspaceRecordFieldModel',
      stepParams: { popupSettings: { openView: { uid: WORKSPACE_RECORD_POPUP_UID } } },
    });
    expect(table.subModels.actions.map((action: { use: string }) => action.use)).toEqual(
      expect.arrayContaining(['LogisticsWorkspaceAddActionModel', 'LogisticsWorkspaceBulkDeleteActionModel']),
    );
    const popup = await models.findModelByParentId(WORKSPACE_RECORD_POPUP_UID, {
      subKey: 'page',
      includeAsyncNode: true,
    });
    expect(
      popup.subModels.tabs.map(
        (item: { stepParams: { pageTabSettings: { tab: { title: string } } } }) =>
          item.stepParams.pageTabSettings.tab.title,
      ),
    ).toEqual(['Рейс', 'Поставки', 'Дерево', 'История', 'Обсуждение']);
    const runContext = popup.subModels.tabs[0].subModels.grid.subModels.items[0];
    expect(runContext.props.entity).toBe('run');
    expect(runContext.subModels.grid.subModels.items.map((item: { use: string }) => item.use)).toEqual([
      'EditFormModel',
    ]);
    const selector = popup.subModels.tabs[1].subModels.grid.subModels.items[0];
    expect(selector.use).toBe('LogisticsWorkspaceShipmentsBlockModel');
    expect(selector.subModels.editor.props).toMatchObject({ entity: 'shipment', isolated: true });
    const nativeRun = await fullModel('lcwscreaterun');
    const nativeShipment = await fullModel('lcwscreateship');
    expect(nativeRun.stepParams.resourceSettings.init.collectionName).toBe('transport_runs');
    expect(nativeShipment.stepParams.resourceSettings.init.collectionName).toBe('shipments');
    expect(nativeShipment.subModels.grid.subModels.items[0].stepParams.fieldSettings.init.fieldPath).toBe('runs');
    expect(table.subModels.actions.filter((action: { use: string }) => /NewRun|NewShipment/.test(action.use))).toEqual(
      [],
    );
    const add = table.subModels.actions.find(
      (action: { use: string }) => action.use === 'LogisticsWorkspaceAddActionModel',
    );
    expect(add.subModels.creators.map((item: { props: { kind: string } }) => item.props.kind)).toEqual(
      expect.arrayContaining(['run', 'shipment']),
    );
    for (const item of nativeShipment.subModels.grid.subModels.items.slice(0, 3)) {
      expect(item.stepParams.editItemSettings.required.required).toBe(true);
    }
    const transportType = nativeRun.subModels.grid.subModels.items.find(
      (field: { stepParams?: { fieldSettings?: { init?: { fieldPath?: string } } } }) =>
        field.stepParams?.fieldSettings?.init?.fieldPath === 'transport_type',
    );
    expect(transportType.stepParams.editItemSettings.required.required).toBe(true);
    const runForm = await fullModel('lcwsrunform');
    expect(
      runForm.subModels.grid.subModels.items.some(
        (item: { stepParams: { fieldSettings: { init: { fieldPath: string } } } }) =>
          item.stepParams.fieldSettings.init.fieldPath === 'shipments',
      ),
    ).toBe(true);
    expect(runForm.subModels.actions).toHaveLength(1);
    expect(runForm.subModels.actions[0].stepParams.buttonSettings.general.title).toBe('Сохранить рейс');
    const popupPaths = await db.getRepository('flowModelTreePath').find({ filter: { descendant: 'lcwsrunshipments' } });
    expect(popupPaths.map((path) => path.get('ancestor'))).toContain(LOGISTICS_WORKSPACE_TAB_UID);
    const docs = await fullModel('lcwscreatedocuments');
    expect(docs.use).toBe('ProcessDocumentsBlockModel');
    const createPage = await models.findModelByParentId('lcwsnewshipment', { subKey: 'page', includeAsyncNode: true });
    expect(
      createPage.subModels.tabs.map(
        (item: { stepParams: { pageTabSettings: { tab: { title: string } } } }) =>
          item.stepParams.pageTabSettings.tab.title,
      ),
    ).toEqual(['Данные поставки', 'Документы']);
  });

  it('assembles the grouped workspace under Information and a separate single-form shipment page', async () => {
    const information = await db
      .getRepository('desktopRoutes')
      .create({ values: { type: 'group', title: 'Информация', schemaUid: 'information' } });
    await db
      .getRepository('rolesDesktopRoutes')
      .create({ values: { desktopRouteId: information.get('id'), roleName: 'custom-role' } });
    const other = await db.getRepository('desktopRoutes').create({
      values: { parentId: information.get('id'), type: 'flowPage', title: 'Китайцы', schemaUid: 'clients' },
    });
    await installWorkspacePresentation(db);
    const initialCount = await db.getRepository('flowModels').count();
    await installWorkspacePresentation(db);
    expect(await db.getRepository('flowModels').count()).toBe(initialCount);
    const route = await db
      .getRepository('desktopRoutes')
      .findOne({ filter: { schemaUid: LOGISTICS_WORKSPACE_ROUTE_UID } });
    expect(route.get('parentId')).toBe(String(information.get('id')));
    expect(route.get('title')).toBe('Рейсы и поставки');
    expect((await db.getRepository('desktopRoutes').findOne({ filter: { schemaUid: 'clients' } })).get('id')).toBe(
      other.get('id'),
    );
    const grid = await models.findModelByParentId(LOGISTICS_WORKSPACE_TAB_UID, { subKey: 'grid' });
    expect(grid.subModels.items[0].use).toBe('LogisticsWorkspaceTableBlockModel');
    const table = await fullModel('lclogworkspacetable');
    expect(table.use).toBe('TableBlockModel');
    expect(table.subModels.columns).toHaveLength(9);
    expect(
      table.subModels.columns.map(
        (column: { stepParams: { fieldSettings: { init: { fieldPath: string } } } }) =>
          column.stepParams.fieldSettings.init.fieldPath,
      ),
    ).not.toContain('run_number');
    expect((await fullModel('lclogworkfilter')).props).toMatchObject({ iconOnly: true, position: 'left' });
    const association = await fullModel('lcwsrunshipments');
    expect(association.subModels.actions.map((action: { use: string }) => action.use)).not.toContain(
      'FilterActionModel',
    );
    expect(association.subModels.actions.map((action: { use: string }) => action.use)).toContain(
      'LogisticsWorkspaceBulkDeleteActionModel',
    );
    expect((await fullModel('lcwsrsassoselecttable')).use).toBe('TableSelectModel');
    const page = await fullModel(WORKSPACE_SHIPMENT_VIEW_UID);
    expect(page.stepParams.popupSettings.openView.mode).toBe('embed');
    const form = await fullModel('lcwspageform');
    expect(form.use).toBe('LogisticsWorkspaceShipmentEditFormModel');
    expect(form.subModels.actions).toHaveLength(1);
    expect(form.subModels.grid.use).toBe('LogisticsWorkspaceShipmentSectionsGridModel');
    expect(form.subModels.grid.subModels.sections).toHaveLength(6);
    const fields = form.subModels.grid.subModels.sections
      .slice(0, 3)
      .flatMap(
        (section: { subModels: { items: { stepParams: { fieldSettings: { init: { fieldPath: string } } } }[] } }) =>
          section.subModels.items.map((field) => field.stepParams.fieldSettings.init.fieldPath),
      );
    expect(fields).not.toContain('runs');
    expect(fields).toContain('ntm_certificate_goods');
    const created = await fullModel('lcwscreateship');
    expect(
      created.subModels.grid.subModels.sections
        .flatMap((section: { subModels?: { items?: unknown[] } }) => section.subModels?.items || [])
        .map(
          (field: { stepParams: { fieldSettings: { init: { fieldPath: string } } } }) =>
            field.stepParams.fieldSettings.init.fieldPath,
        ),
    ).not.toContain('runs');
    const paths = await db.getRepository('flowModelTreePath').find({ filter: { descendant: 'lcwsrsassoselecttable' } });
    expect(paths.map((path) => path.get('ancestor'))).toContain(LOGISTICS_WORKSPACE_TAB_UID);
  });

  it('recreates a missing workspace route and rolls menu changes back when assembly fails', async () => {
    await db.getRepository('desktopRoutes').destroy({ filter: { schemaUid: LOGISTICS_WORKSPACE_ROUTE_UID } });
    const failed = vi.spyOn(models, 'upsertModel').mockRejectedValueOnce(new Error('unavailable'));
    await expect(installWorkspacePresentation(db)).rejects.toThrow('unavailable');
    expect(await db.getRepository('desktopRoutes').count()).toBe(0);
    failed.mockRestore();
    await installWorkspacePresentation(db);
    expect(await db.getRepository('desktopRoutes').count({ filter: { type: 'group', title: 'Информация' } })).toBe(1);
    expect(
      await db.getRepository('desktopRoutes').count({ filter: { schemaUid: LOGISTICS_WORKSPACE_ROUTE_UID } }),
    ).toBe(1);
  });

  it('repairs the released form ownership without replacing configured fields and uses native routed views', async () => {
    await installWorkspacePresentation(db);
    const before = await fullModel('lcwsrunform');
    const fields = before.subModels.grid.subModels.items.map((field: { uid: string }) => field.uid);
    // Reproduce the 2.0.107 layout: the forms were siblings of the rendered grid.
    for (const [uid, parentId] of [
      ['lcwsrunform', 'lcwsruncontext'],
      ['lcwscreateship', 'lcwsnewshipcontext'],
    ]) {
      await models.upsertModel({ uid, parentId, subKey: 'items', subType: 'array' });
      await models.attach(uid, { parentId, subKey: 'items', subType: 'array', position: 'last' });
    }
    await repairWorkspacePresentation(db);
    await repairWorkspacePresentation(db);
    const run = await fullModel('lcwsruncontext');
    const create = await fullModel('lcwsnewshipcontext');
    expect(run.subModels.grid.subModels.items.map((model: { uid: string }) => model.uid)).toContain('lcwsrunform');
    expect(create.subModels.grid.subModels.items.map((model: { uid: string }) => model.uid)).toContain(
      'lcwscreateship',
    );
    expect((await fullModel('lcwsnewshippage')).use).toBe('ChildPageModel');
    expect(
      (await fullModel('lcwsrunform')).subModels.grid.subModels.items.map((field: { uid: string }) => field.uid),
    ).toEqual(fields);
    for (const uid of ['lcwsrecordpopup', WORKSPACE_SHIPMENT_VIEW_UID, 'lcwsnewshipment']) {
      const popup = await fullModel(uid);
      expect(popup.use).toBe('LogisticsWorkspacePopupActionModel');
      expect(popup.stepParams.popupSettings.openView.navigation).toBe(true);
    }
    expect(
      (await db.getRepository('desktopRoutes').findOne({ filter: { schemaUid: LOGISTICS_WORKSPACE_ROUTE_UID } })).get(
        'icon',
      ),
    ).toBeNull();
  });

  it('upgrades both native run dialogs and categorizes forms without replacing field configuration', async () => {
    await installWorkspacePresentation(db);
    await models.upsertModel({
      uid: 'lcwsadd',
      stepParams: { popupSettings: { openView: { mode: 'drawer', uid: 'lclogworknewrun' } } },
    });
    await models.upsertModel({
      uid: 'lclogworknewrun',
      stepParams: { popupSettings: { openView: { mode: 'drawer' } } },
    });
    const original = await fullModel('lcwsrunform');
    const fields = original.subModels.grid.subModels.items.filter(
      (item: { use: string }) => item.use === 'FormItemModel',
    );
    await models.upsertModel({ uid: fields[0].uid, props: { tooltip: 'Сохранить настройку' } });
    await refineWorkspacePresentation(db);
    const count = await models.count();
    await refineWorkspacePresentation(db);
    expect(await models.count()).toBe(count);
    for (const uid of ['lcwsadd', 'lclogworknewrun', 'lcwsrecordpopup'])
      expect((await fullModel(uid)).stepParams.popupSettings.openView).toMatchObject({
        mode: 'dialog',
        size: 'large',
      });
    for (const uid of ['lcwsrunform', 'lcwscreaterun']) {
      const form = await fullModel(uid);
      const items = form.subModels.grid.subModels.items;
      expect(
        items
          .filter((item: { use: string }) => item.use === 'DividerItemModel')
          .map(
            (item: { stepParams: { markdownItemSetting: { title: { label: string } } } }) =>
              item.stepParams.markdownItemSetting.title.label,
          ),
      ).toEqual(['Основные данные', 'Ответственные', 'Связи рейсов']);
      const fieldPaths = items
        .filter((item: { use: string }) => item.use === 'FormItemModel')
        .map(
          (item: { stepParams: { fieldSettings: { init: { fieldPath: string } } } }) =>
            item.stepParams.fieldSettings.init.fieldPath,
        );
      expect(new Set(fieldPaths).size).toBe(fieldPaths.length);
      expect(fieldPaths).toEqual([
        'transport_type',
        'registration_number_input',
        'departure_city',
        'managers',
        'declarants',
        'parent_runs',
      ]);
      expect(form.subModels.actions).toHaveLength(1);
    }
    expect((await fullModel(fields[0].uid)).props.tooltip).toBe('Сохранить настройку');
  });

  it('loads view-dependent models only from their own native view boundary and preserves creation field identities', async () => {
    await installWorkspacePresentation(db);
    const created = await fullModel('lcwscreateship');
    const sections = created.subModels.grid.subModels.sections;
    const fields = sections.flatMap(
      (section: { subModels?: { items?: WorkspaceFlowTree[] } }) => section.subModels?.items || [],
    );
    const identifiers = fields.map((field: { uid: string }) => field.uid).sort();
    const original = fields[0];
    await models.upsertModel({ uid: original.uid, props: { tooltip: 'Моя настройка поля' } });
    // Restore the released flat form and eager page graph before applying the new migration.
    await models.upsertModel({ uid: 'lcwscreateshipgrid', use: 'FormGridModel' });
    for (const field of fields)
      await models.attach(field.uid, {
        parentId: 'lcwscreateshipgrid',
        subKey: 'items',
        subType: 'array',
        position: 'last',
      });
    const eager = ['lcwsrecordpage', 'lcwsruntabgrid', 'lcwsshiptabgrid', 'lcwsrsassoselectgrid'];
    for (const uid of eager)
      await db
        .getRepository('flowModelTreePath')
        .update({ filter: { ancestor: uid, descendant: uid, depth: 0 }, values: { async: false } });
    const before = await models.findModelById('lcwsrecordpopup');
    expect(before.subModels.page.subModels.tabs[1].subModels.grid).toBeTruthy();
    await configureWorkspaceViewLoading(db);
    const count = await models.count();
    await configureWorkspaceViewLoading(db);
    expect(await models.count()).toBe(count);
    const closed = await models.findModelById('lcwsrecordpopup');
    expect(closed.subModels?.page).toBeUndefined();
    const page = await models.findModelByParentId('lcwsrecordpopup', { subKey: 'page' });
    expect(page.subModels.tabs.every((tab: { subModels?: { grid?: unknown } }) => !tab.subModels?.grid)).toBe(true);
    const runGrid = await models.findModelByParentId('lcwsruntab', { subKey: 'grid' });
    expect(runGrid.subModels.items[0].use).toBe('LogisticsWorkspaceContextBlockModel');
    expect((await models.findModelById('lcwsrsassociate')).subModels?.['associate-selector-grid']).toBeUndefined();
    const selector = await models.findModelByParentId('lcwsrsassociate', { subKey: 'associate-selector-grid' });
    expect(selector.subModels.items[0].use).toBe('TableSelectModel');
    const form = await fullModel('lcwscreateship');
    expect(form.subModels.actions).toHaveLength(1);
    expect(form.subModels.grid.use).toBe('LogisticsWorkspaceShipmentSectionsGridModel');
    expect(
      form.subModels.grid.subModels.sections.map(
        (section: { props: { workspaceSectionTitle: string } }) => section.props.workspaceSectionTitle,
      ),
    ).toEqual(['Основное', 'Таможенное оформление', 'НТМ', 'Документы']);
    const moved = form.subModels.grid.subModels.sections.flatMap(
      (section: { subModels?: { items?: WorkspaceFlowTree[] } }) => section.subModels?.items || [],
    );
    expect(moved.map((field: { uid: string }) => field.uid).sort()).toEqual(identifiers);
    expect((await fullModel(original.uid)).props.tooltip).toBe('Моя настройка поля');
    const mandatory = moved.filter(
      (field: { stepParams?: { editItemSettings?: { required?: { required: boolean } } } }) =>
        field.stepParams?.editItemSettings?.required?.required,
    );
    expect(mandatory).toHaveLength(3);
    for (const uid of ['lcwsnewshipment', 'lcwsrsnew'])
      expect((await fullModel(uid)).stepParams.popupSettings.openView).toMatchObject({ mode: 'dialog', size: 'large' });
    expect((await fullModel('lcwscreatedocuments')).parentId).toBe('lcwscreateshipgrid');
  });
});
