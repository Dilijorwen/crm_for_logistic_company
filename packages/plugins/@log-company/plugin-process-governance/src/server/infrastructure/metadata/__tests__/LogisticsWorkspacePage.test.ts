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
    ).toEqual(['Рейс', 'Поставки', 'Дерево', 'История']);
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
