/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database, MigrationContext, Model } from '@nocobase/database';
import { createMockDatabase, MagicAttributeModel, DataTypes } from '@nocobase/database';
import type { Context } from '@nocobase/actions';
import { Application, type Plugin } from '@nocobase/server';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import tablePersonalizations from '../collections/tablePersonalizations';
import { NocoBasePersonalizationRepository } from '../infrastructure/NocoBasePersonalizationRepository';
import { NocoBaseTableConfiguration } from '../infrastructure/NocoBaseTableConfiguration';
import CascadeMigration from '../migrations/20261009090000-personalization-cascades';
import type { ColumnSettings } from '../../shared/contracts';
import { TablePersonalizations } from '../application/TablePersonalizations';
import tableFilterTemplates from '../collections/tableFilterTemplates';
import {
  FILTER_TEMPLATES_COLLECTION,
  NocoBaseFilterTemplateRepository,
  TEMPLATE_INITIALIZATIONS_COLLECTION,
} from '../infrastructure/NocoBaseFilterTemplateRepository';
import FilterTemplateMigration from '../migrations/20261028010000-filter-template-cascades';
import { TableFilterTemplates } from '../application/TableFilterTemplates';
import { emptyFilter } from '../../shared/filterTemplates';
import PersonalTableTemplatesMigration from '../migrations/20261102010000-personal-table-templates';
import { FilterTemplateError } from '../domain/FilterTemplateError';
import tableTemplateInitializations from '../collections/tableTemplateInitializations';
import TemplateInitializationMigration from '../migrations/20261109010000-template-initialization-cascades';
import { TableFilterTemplateController } from '../interfaces/TableFilterTemplateController';

const run = process.env.TABLE_PERSONALIZATION_POSTGRES_INTEGRATION === '1' && process.env.DB_DIALECT === 'postgres';
const settings: ColumnSettings = { version: 1, columnOrder: ['first', 'second'], hiddenColumnUids: ['first'] };

describe.runIf(run)('personalizations PostgreSQL persistence and access', () => {
  let database: Database;
  let repository: NocoBasePersonalizationRepository;
  let migration: CascadeMigration;
  let plugin: Plugin;
  let filterRepository: NocoBaseFilterTemplateRepository;
  let filterMigration: FilterTemplateMigration;
  const can = vi.fn();
  const loadResourcesByLang = vi.fn();
  const translate = vi.fn(() => 'В работе');

  beforeAll(async () => {
    if (
      !process.env.DB_DATABASE?.startsWith('table_personalization_test') ||
      !process.env.DB_TEST_PREFIX?.startsWith('table_personalization_test')
    ) {
      throw new Error('These tests require an isolated table_personalization_test database.');
    }
    database = await createMockDatabase();
    await database.clean({ drop: true });
    database.collection({
      name: 'users',
      autoGenId: false,
      fields: [{ name: 'id', type: 'bigInt', primaryKey: true }],
    });
    database.registerModels({
      FlowSchemaModel: MagicAttributeModel as unknown as Parameters<Database['registerModels']>[0][string],
    });
    database.collection({
      name: 'flowModels',
      model: 'FlowSchemaModel',
      magicAttribute: 'options',
      autoGenId: false,
      timestamps: false,
      fields: [
        { name: 'uid', type: 'string', primaryKey: true },
        { name: 'options', type: 'json' },
      ],
    });
    database.collection({
      name: 'flowModelTreePath',
      autoGenId: false,
      timestamps: false,
      fields: [
        { name: 'ancestor', type: 'string', primaryKey: true },
        { name: 'descendant', type: 'string', primaryKey: true },
        { name: 'depth', type: 'integer' },
        { name: 'sort', type: 'integer' },
      ],
    });
    database.collection({
      name: 'desktopRoutes',
      fields: [
        { name: 'schemaUid', type: 'string' },
        { name: 'parentId', type: 'bigInt' },
      ],
    });
    database.collection({
      name: 'roles',
      autoGenId: false,
      fields: [
        { name: 'name', type: 'string', primaryKey: true },
        { name: 'desktopRoutes', type: 'belongsToMany', target: 'desktopRoutes', through: 'rolesDesktopRoutes' },
      ],
    });
    database.collection({
      name: 'records',
      fields: [
        { name: 'first', type: 'string' },
        { name: 'second', type: 'string' },
        { name: 'extra', type: 'string', interface: 'input', uiSchema: { title: 'Дополнительное поле' } },
        { name: 'secret', type: 'string', interface: 'input' },
        { name: 'internallyHidden', type: 'string', interface: 'input', hidden: true },
        { name: 'department', type: 'belongsTo', target: 'departments' },
      ],
    });
    database.collection({ name: 'departments', titleField: 'name', fields: [{ name: 'name', type: 'string' }] });
    database.collection({
      name: 'status_records',
      fields: [
        {
          name: 'status',
          type: 'string',
          interface: 'select',
          uiSchema: {
            enum: [
              { value: 'queue', label: 'В очереди' },
              { value: 'in_work', label: '{{t("status.in_work", { ns: "@log-company/plugin-test" })}}' },
            ],
          },
        },
        { name: 'title', type: 'string' },
      ],
    });
    database.collection(tablePersonalizations);
    database.collection(tableFilterTemplates);
    database.collection(tableTemplateInitializations);
    await database.sync();
    const context: MigrationContext = {
      db: database,
      queryInterface: database.sequelize.getQueryInterface(),
      sequelize: database.sequelize,
    };
    migration = new CascadeMigration(context);
    await migration.up();
    await migration.up();
    filterMigration = new FilterTemplateMigration(context);
    await filterMigration.up();
    await filterMigration.up();
    const initializationMigration = new TemplateInitializationMigration(context);
    await initializationMigration.up();
    await initializationMigration.up();
    filterRepository = new NocoBaseFilterTemplateRepository(database);
    repository = new NocoBasePersonalizationRepository(database);
    await database.getRepository('users').create({ values: [{ id: '1' }, { id: '2' }, { id: '3' }] });
    const models = [
      { uid: 'page', options: {} },
      {
        uid: 'table',
        options: {
          use: 'TableBlockModel',
          stepParams: {
            resourceSettings: { init: { dataSourceKey: 'main', collectionName: 'records' } },
          },
        },
      },
      {
        uid: 'status-table',
        options: {
          use: 'TableBlockModel',
          stepParams: { resourceSettings: { init: { dataSourceKey: 'main', collectionName: 'status_records' } } },
        },
      },
      ...['first', 'second', 'relation'].map((uid, index) => ({
        uid,
        options: {
          use: 'TableColumnModel',
          parentId: 'table',
          subKey: 'columns',
          sortIndex: index,
          stepParams: {
            fieldSettings: {
              init: {
                dataSourceKey: 'main',
                collectionName: 'records',
                fieldPath: uid === 'relation' ? 'department.name' : uid,
              },
            },
          },
        },
      })),
      ...['ref-one', 'ref-two'].map((uid) => ({
        uid,
        options: { use: 'ReferenceBlockModel', stepParams: { referenceSettings: { target: { targetUid: 'table' } } } },
      })),
    ];
    await database.getRepository('flowModels').create({ values: models });
    await database.getRepository('flowModelTreePath').create({
      values: ['table', 'status-table', 'ref-one', 'ref-two'].map((uid) => ({
        ancestor: 'page',
        descendant: uid,
        depth: 1,
      })),
    });
    await database.getRepository('flowModelTreePath').create({
      values: ['first', 'second', 'relation'].map((uid, sort) => ({
        ancestor: 'table',
        descendant: uid,
        depth: 1,
        sort,
      })),
    });
    const route = await database.getRepository('desktopRoutes').create({ values: { schemaUid: 'page' } });
    await database.getRepository('roles').create({ values: { name: 'reader', desktopRoutes: [route.get('id')] } });
    plugin = {
      db: database,
      app: {
        localeManager: { loadResourcesByLang },
        i18n: { t: translate },
        dataSourceManager: {
          get: () => ({
            acl: { can },
            collectionManager: { getCollection: (name: string) => database.getCollection(name) },
          }),
        },
      },
    } as unknown as Plugin;
  }, 30000);

  afterAll(async () => {
    if (database) {
      await database.clean({ drop: true });
      await database.close();
    }
  });

  const owner = (userId: string, instanceKey = 'instance', root = 'table') => ({
    userId,
    instanceKey,
    instanceRootUid: root,
    tableUid: 'table',
  });
  const gateway = (roles: string[] = ['root']) =>
    new NocoBaseTableConfiguration(plugin, { state: { currentRoles: roles } } as unknown as Context);

  const templateInput = async (identity = { tableUid: 'table', referencePath: [] as string[] }) => ({
    identity,
    name: 'Личный',
    filter: emptyFilter(),
    columnSettings: { ...settings, columnWidths: { first: 210 } },
    schemaSignature: (await gateway().authorize(identity)).schemaSignature,
  });

  it('creates independent personal status templates once without replacing custom templates', async () => {
    can.mockReturnValue({ params: {} });
    const identity = { tableUid: 'status-table', referencePath: [] };
    const first = new TableFilterTemplates(gateway(), filterRepository, '1');
    const second = new TableFilterTemplates(gateway(), filterRepository, '2');
    const table = await gateway().authorize(identity);
    const ownTemplate = {
      identity,
      name: 'В работе',
      filter: emptyFilter(),
      columnSettings: { version: 1, columnOrder: [], hiddenColumnUids: [] },
      schemaSignature: table.schemaSignature,
    };
    await first.execute('create', ownTemplate);
    const [firstList, concurrentList, secondList] = await Promise.all([
      first.execute('list', { identity }),
      first.execute('list', { identity }),
      second.execute('list', { identity }),
    ]);
    expect(firstList).toEqual(concurrentList);
    expect(firstList.templates).toHaveLength(2);
    expect(firstList.templates.find(({ name }) => name === ownTemplate.name)?.filter).toEqual(emptyFilter());
    expect(secondList.templates.find(({ name }) => name === ownTemplate.name)?.filter.items).toEqual([
      { path: 'status', operator: '$eq', value: 'in_work' },
    ]);
    const firstQueue = firstList.templates.find(({ name }) => name === 'В очереди');
    if (!firstQueue) throw new Error('Missing status template');
    expect(secondList.templates.find(({ name }) => name === firstQueue.name)?.id).not.toBe(firstQueue.id);
    await first.execute('delete', { identity, id: firstQueue.id, revision: firstQueue.revision });
    expect((await first.execute('list', { identity })).templates).toHaveLength(1);
    expect((await second.execute('list', { identity })).templates).toHaveLength(2);
  });

  it('checks status field permissions before initial creation and sends update through the real HTTP guard', async () => {
    const identity = { tableUid: 'status-table', referencePath: [] };
    const reader = new TableFilterTemplates(gateway(['reader']), filterRepository, '3');
    can.mockReturnValue({ params: { fields: ['title'] } });
    expect((await reader.execute('list', { identity })).templates).toEqual([]);
    can.mockReturnValue({ params: {} });
    const { templates, schemaSignature } = await reader.execute('list', { identity });
    expect(templates).toHaveLength(2);
    expect(loadResourcesByLang).toHaveBeenCalledWith('ru-RU');
    expect(translate).toHaveBeenCalledWith('status.in_work', {
      ns: '@log-company/plugin-test',
      lng: 'ru-RU',
      defaultValue: 'in_work',
    });
    const [template] = templates;
    const app = new Application({
      database: { dialect: 'sqlite', storage: ':memory:' },
      resourcer: { prefix: '/api' },
      acl: false,
      dataWrapping: false,
      registerActions: false,
    });
    try {
      new TableFilterTemplateController(
        { app } as Plugin,
        (_context, userId) => new TableFilterTemplates(gateway(['reader']), filterRepository, userId),
        [FILTER_TEMPLATES_COLLECTION, TEMPLATE_INITIALIZATIONS_COLLECTION],
      ).register();
      app.resourceManager.use(
        async (ctx, next) => {
          ctx.state.currentUser = { id: '3' };
          await next();
        },
        { tag: 'test-authentication', before: 'auth' },
      );
      const filter = emptyFilter();
      const payload = {
        identity,
        id: template.id,
        revision: template.revision,
        filter,
        columnSettings: template.columnSettings,
        schemaSignature,
      };
      const request = supertest(app.callback());
      const endpoint = '/api/tableFilterTemplates:update';
      expect((await request.post(endpoint).send(payload)).status).toBe(500);
      const response = await request.post(endpoint).query({ filterByTk: template.id }).send(payload);
      expect(response.status, response.text).toBe(200);
      expect(response.body.templates.find(({ id }: { id: string }) => id === template.id)).toMatchObject({
        filter,
        revision: template.revision + 1,
      });
    } finally {
      await app.destroy();
    }
  });

  it('persists complete personal templates and isolates authors including root accounts', async () => {
    can.mockReturnValue({ params: {} });
    const first = new TableFilterTemplates(gateway(), filterRepository, '1');
    const otherRoot = new TableFilterTemplates(gateway(), filterRepository, '2');
    const input = await templateInput();
    const created = await first.execute('create', input);
    expect(created.templates[0]).toMatchObject({
      name: input.name,
      filter: input.filter,
      columnSettings: { columnWidths: { first: 210 }, hiddenColumnUids: expect.arrayContaining(['first']) },
    });
    expect((await otherRoot.execute('list', { identity: input.identity })).templates).toEqual([]);
    await otherRoot.execute('create', input);
    expect((await first.execute('list', { identity: input.identity })).templates).toHaveLength(1);
    await expect(first.execute('create', input)).rejects.toThrow('DUPLICATE_NAME');
    const template = created.templates[0];
    await expect(
      otherRoot.execute('delete', { identity: input.identity, id: template.id, revision: 1 }),
    ).rejects.toThrow('NOT_FOUND');
  });

  it('serializes concurrent edits and isolates reference instances', async () => {
    can.mockReturnValue({ params: {} });
    const identity = { tableUid: 'table', referencePath: ['ref-one'] };
    const useCase = new TableFilterTemplates(gateway(), filterRepository, '1');
    const created = await useCase.execute('create', { ...(await templateInput(identity)), name: 'Гонка' });
    const template = created.templates[0];
    const edits = await Promise.allSettled(
      ['Первая', 'Вторая'].map((name) => useCase.execute('rename', { identity, id: template.id, revision: 1, name })),
    );
    expect(edits.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(edits.find((result) => result.status === 'rejected')).toMatchObject({
      status: 'rejected',
      reason: new FilterTemplateError('CONFLICT'),
    });
    const saved = (await useCase.execute('list', { identity })).templates[0];
    await expect(
      useCase.execute('delete', {
        identity: { ...identity, referencePath: ['ref-two'] },
        id: saved.id,
        revision: saved.revision,
      }),
    ).rejects.toThrow('NOT_FOUND');
    await useCase.execute('delete', { identity, id: saved.id, revision: saved.revision });
    await expect(useCase.execute('delete', { identity, id: saved.id, revision: saved.revision })).rejects.toThrow(
      'NOT_FOUND',
    );
  });

  it('hides inaccessible saved filters and masks restricted columns without deleting their snapshots', async () => {
    can.mockReturnValue({ params: {} });
    const identity = { tableUid: 'table', referencePath: [] };
    const useCase = new TableFilterTemplates(gateway(), filterRepository, '1');
    await useCase.execute('create', {
      ...(await templateInput()),
      name: 'Ограниченный',
      filter: { logic: '$and', items: [{ path: 'secret', operator: '$eq', value: 'private' }] },
    });
    can.mockReturnValue({ params: { fields: ['first'] } });
    const restricted = new TableFilterTemplates(gateway(['reader']), filterRepository, '1');
    const listed = await restricted.execute('list', { identity });
    expect(listed.templates.some((template) => template.name === 'Ограниченный')).toBe(false);
    expect(listed.templates[0].columnSettings.columnOrder).not.toContain('second');
    await expect(
      restricted.execute('create', {
        ...(await templateInput()),
        columnSettings: { version: 1, columnOrder: ['first'], hiddenColumnUids: [] },
        name: 'Запрещённый',
        filter: { logic: '$and', items: [{ path: 'secret', operator: '$eq', value: 'test' }] },
      }),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('restores exact template widths without affecting another user and resets to the shared baseline', async () => {
    can.mockReturnValue({ params: {} });
    const identity = { tableUid: 'table', referencePath: [] };
    const first = new TablePersonalizations(gateway(), repository, '1');
    const second = new TablePersonalizations(gateway(), repository, '2');
    const metadata = await first.execute('get', { identity });
    for (const useCase of [first, second])
      await useCase.execute('width', {
        identity,
        columnUid: 'first',
        width: 330,
        schemaSignature: metadata.schemaSignature,
      });
    await first.execute('restore', {
      identity,
      settings: { ...settings, columnWidths: { second: 250 } },
      schemaSignature: metadata.schemaSignature,
    });
    expect((await first.execute('get', { identity })).settings?.columnWidths).toEqual({ second: 250 });
    expect((await second.execute('get', { identity })).settings?.columnWidths).toEqual({ first: 330 });
    expect((await first.execute('reset', { identity })).settings).toBeNull();
    await second.execute('reset', { identity });
  });

  it('upgrades legacy sharing schema, removes only old templates and preserves new data on retry', async () => {
    const query = database.sequelize.getQueryInterface();
    const legacyTable = 'lc_template_legacy_migration_test';
    await query.createTable(legacyTable, {
      id: { type: DataTypes.STRING, primaryKey: true },
      userId: { type: DataTypes.BIGINT, allowNull: false },
      instanceKey: { type: DataTypes.STRING, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      scopeKey: { type: DataTypes.STRING, allowNull: false },
      visibility: { type: DataTypes.STRING, allowNull: false },
    });
    await query.addIndex(legacyTable, ['instanceKey', 'scopeKey', 'name'], {
      name: 'lc_filter_templates_legacy_test_name',
      unique: true,
    });
    await query.bulkInsert(legacyTable, [
      { id: 'old', userId: '1', instanceKey: 'instance', name: 'Старый', scopeKey: 'shared', visibility: 'shared' },
    ]);
    // The migration resolves the physical table through the collection, including schema/prefix installations.
    const original = database.getCollection.bind(database);
    const getCollection = vi
      .spyOn(database, 'getCollection')
      .mockImplementation((name) =>
        name === 'lc_table_filter_templates'
          ? ({ model: { getTableName: () => legacyTable } } as unknown as ReturnType<Database['getCollection']>)
          : original(name),
      );
    const context: MigrationContext = { db: database, queryInterface: query, sequelize: database.sequelize };
    try {
      // Use the production index name after temporarily removing the current-table index in this isolated DB.
      await query.removeIndex(original('lc_table_filter_templates').model.getTableName(), 'lc_filter_templates_name');
      const migration = new PersonalTableTemplatesMigration(context);
      await migration.up();
      const columns = await query.describeTable(legacyTable);
      expect(columns.columnSettings.allowNull).toBe(false);
      expect(columns.scopeKey).toBeUndefined();
      expect(columns.visibility).toBeUndefined();
      const [oldRows] = await database.sequelize.query('SELECT id FROM lc_template_legacy_migration_test');
      expect(oldRows).toEqual([]);
      await query.bulkInsert(legacyTable, [
        { id: 'new', userId: '1', instanceKey: 'instance', name: 'Новый', columnSettings: JSON.stringify(settings) },
      ]);
      await migration.up();
      const [newRows] = await database.sequelize.query('SELECT id FROM lc_template_legacy_migration_test');
      expect(newRows).toEqual([{ id: 'new' }]);
    } finally {
      getCollection.mockRestore();
      await query.dropTable(legacyTable);
      await query.addIndex(
        original('lc_table_filter_templates').model.getTableName(),
        ['instanceKey', 'userId', 'name'],
        { name: 'lc_filter_templates_name', unique: true },
      );
    }
  });

  it('keeps cascade migrations idempotent and deletes metadata with its author', async () => {
    await filterMigration.down();
    await filterMigration.up();
    await filterMigration.up();
    await database.getRepository('users').create({ values: { id: '4' } });
    const saved = await filterRepository.create({
      userId: '4',
      instanceKey: 'cascade-filter',
      instanceRootUid: 'table',
      tableUid: 'table',
      name: 'Каскад',
      filter: emptyFilter(),
      columnSettings: settings,
      revision: 1,
    });
    await database.getRepository('users').destroy({ filterByTk: '4' });
    expect(await database.getRepository('lc_table_filter_templates').findOne({ filterByTk: saved.id })).toBeNull();
  });

  it('upserts atomically, isolates users/instances and resets only the owner', async () => {
    await Promise.all([repository.save(owner('1'), settings), repository.save(owner('1'), settings)]);
    await repository.save(owner('2'), { ...settings, hiddenColumnUids: [] });
    expect(await database.getRepository('lc_table_personalizations').count()).toBe(2);
    expect(await repository.find(owner('1'))).toEqual(settings);
    expect(await repository.find(owner('1', 'other'))).toBeNull();
    await repository.reset(owner('1'));
    await repository.reset(owner('1'));
    expect(await repository.find(owner('2'))).not.toBeNull();
    await repository.reset(owner('2'));
  });

  it('resets to current editor tree order and preserves that order on the next width change', async () => {
    can.mockReturnValue({ params: {} });
    const identity = { tableUid: 'table', referencePath: [] };
    const configuration = gateway();
    const useCase = new TablePersonalizations(configuration, repository, '3');
    const initial = await useCase.execute('get', { identity });
    const models = database.getRepository('flowModels');
    const paths = database.getRepository('flowModelTreePath');
    const sharedBefore = (await models.find({ filter: { 'options.parentId': 'table' }, sort: ['uid'] })).map(
      (model: Model) => model.toJSON(),
    );
    await useCase.execute('save', { identity, settings, schemaSignature: initial.schemaSignature });
    await useCase.execute('width', {
      identity,
      columnUid: 'first',
      width: 260,
      schemaSignature: initial.schemaSignature,
    });
    try {
      // FlowEngine's move operation updates tree-path sort without rewriting options.sortIndex.
      for (const [sort, descendant] of ['second', 'relation', 'first'].entries()) {
        await paths.update({ filter: { ancestor: 'table', descendant, depth: 1 }, values: { sort } });
      }
      const sharedOrder = ['second', 'relation', 'first'];
      const reset = await useCase.execute('reset', { identity });
      expect(reset.settings).toBeNull();
      expect(reset.columns.filter((column) => !column.source).map((column) => column.uid)).toEqual(sharedOrder);
      expect(reset.schemaSignature).not.toBe(initial.schemaSignature);
      const resized = await useCase.execute('width', {
        identity,
        columnUid: 'second',
        width: 310,
        schemaSignature: reset.schemaSignature,
      });
      expect(resized.settings?.columnOrder.filter((uid) => sharedOrder.includes(uid))).toEqual(sharedOrder);
      expect(resized.settings?.columnWidths).toEqual({ second: 310 });
      expect(
        (await models.find({ filter: { 'options.parentId': 'table' }, sort: ['uid'] })).map((model: Model) =>
          model.toJSON(),
        ),
      ).toEqual(sharedBefore);
      await useCase.execute('reset', { identity });
      expect((await useCase.execute('get', { identity })).settings).toBeNull();
    } finally {
      for (const [sort, descendant] of ['first', 'second', 'relation'].entries()) {
        await paths.update({ filter: { ancestor: 'table', descendant, depth: 1 }, values: { sort } });
      }
      await useCase.execute('reset', { identity });
    }
  });

  it('checks route and collection permissions and excludes restricted relation fields', async () => {
    can.mockImplementation(({ resource }: { resource: string }) =>
      resource === 'records' ? { params: { fields: ['first', 'department'] } } : null,
    );
    const table = await gateway(['reader']).authorize({ tableUid: 'table', referencePath: [] });
    expect(table.columns.map((column) => column.uid)).toEqual(['first']);
    await expect(gateway(['unassigned']).authorize({ tableUid: 'table', referencePath: [] })).rejects.toThrow(
      'FORBIDDEN',
    );
    can.mockReturnValue(null);
    await expect(gateway().authorize({ tableUid: 'table', referencePath: [] })).rejects.toThrow('FORBIDDEN');
    await expect(gateway().authorize({ tableUid: 'missing', referencePath: [] })).rejects.toThrow('NOT_FOUND');
  });

  it('canonicalizes reference placements and rejects forged paths', async () => {
    can.mockReturnValue({ params: {} });
    const regular = await gateway().authorize({ tableUid: 'table', referencePath: [] });
    const first = await gateway().authorize({ tableUid: 'table', referencePath: ['ref-one'] });
    const second = await gateway().authorize({ tableUid: 'table', referencePath: ['ref-two'] });
    expect(new Set([regular.instanceKey, first.instanceKey, second.instanceKey]).size).toBe(3);
    expect(first.instanceRootUid).toBe('ref-one');
    await expect(gateway().authorize({ tableUid: 'table', referencePath: ['page'] })).rejects.toThrow('FORBIDDEN');
    await database.getRepository('flowModels').update({
      filterByTk: 'ref-two',
      values: {
        options: {
          use: 'ReferenceBlockModel',
          stepParams: { referenceSettings: { target: { targetUid: 'ref-two' } } },
        },
      },
    });
    await expect(gateway().authorize({ tableUid: 'table', referencePath: ['ref-two'] })).rejects.toThrow('FORBIDDEN');
  });

  it('checks dotted append and except permissions before exposing relation descriptors', async () => {
    can.mockImplementation(({ resource }: { resource: string }) => ({
      params: resource === 'records' ? { fields: ['first'], appends: ['department.code'] } : {},
    }));
    expect(
      (await gateway().authorize({ tableUid: 'table', referencePath: [] })).columns.map((column) => column.uid),
    ).toEqual(['first']);
    can.mockImplementation(({ resource }: { resource: string }) => ({
      params: resource === 'records' ? { appends: ['department'], except: ['department.name'] } : {},
    }));
    expect((await gateway().authorize({ tableUid: 'table', referencePath: [] })).columns).toEqual([]);
  });

  it('changes schema signature on column edits without changing shared models on save', async () => {
    can.mockReturnValue({ params: {} });
    const before = await gateway().authorize({ tableUid: 'table', referencePath: [] });
    const savedBefore = await database.getRepository('flowModels').findOne({ filterByTk: 'first' });
    await repository.save(owner('1'), settings);
    const savedAfter = await database.getRepository('flowModels').findOne({ filterByTk: 'first' });
    expect(savedAfter.toJSON()).toEqual(savedBefore.toJSON());
    await database
      .getRepository('flowModels')
      .update({ filterByTk: 'first', values: { options: { ...savedAfter.get('options'), sortIndex: 10 } } });
    expect((await gateway().authorize({ tableUid: 'table', referencePath: [] })).schemaSignature).not.toBe(
      before.schemaSignature,
    );
  });

  it('offers permitted collection fields outside configured columns and uses stable opaque identifiers', async () => {
    can.mockImplementation(({ resource, action }: { resource: string; action: string }) =>
      action === 'list' && resource === 'records' ? { params: { fields: ['first', 'extra'] } } : null,
    );
    const authorized = await gateway(['reader']).authorize({ tableUid: 'table', referencePath: [] });
    expect(authorized.columns.map((column) => column.fieldPath)).toEqual(['first', 'extra']);
    const extra = authorized.columns[1];
    expect(extra).toMatchObject({ title: 'Дополнительное поле', source: 'collection', fixed: 'normal' });
    expect(extra.uid).toMatch(/^lc_field_[a-f0-9]{64}$/);
    expect((await gateway(['reader']).authorize({ tableUid: 'table', referencePath: [] })).columns[1].uid).toBe(
      extra.uid,
    );
    expect(authorized.columns.some((column) => column.fieldPath === 'secret')).toBe(false);
  });

  it('excludes fields and relation labels omitted by NocoBase serialization even for unrestricted readers', async () => {
    can.mockReturnValue({ params: {} });
    const records = database.getCollection('records');
    const departments = database.getCollection('departments');
    const firstOptions = { ...records.getField('first').options };
    const labelOptions = { ...departments.getField('name').options };
    const identity = { tableUid: 'table', referencePath: [] };
    const before = await gateway().authorize(identity);
    expect(before.columns.some((column) => column.fieldPath === 'internallyHidden')).toBe(false);
    const businessRecord = await database
      .getRepository('records')
      .create({ values: { internallyHidden: 'Hidden value' } });
    expect(businessRecord.toJSON()).not.toHaveProperty('internallyHidden');
    try {
      records.setField('first', { ...firstOptions, hidden: true });
      departments.setField('name', { ...labelOptions, hidden: true });
      const hidden = await gateway().authorize(identity);
      expect(
        hidden.columns.some((column) => ['first', 'department', 'department.name'].includes(column.fieldPath)),
      ).toBe(false);
      expect(hidden.existingColumnUids).toContain('first');
      expect(hidden.schemaSignature).not.toBe(before.schemaSignature);
    } finally {
      records.setField('first', firstOptions);
      departments.setField('name', labelOptions);
    }
  });

  it('saves additional fields for one user without changing shared FlowEngine models or business records', async () => {
    can.mockReturnValue({ params: { fields: ['first', 'extra'] } });
    const identity = { tableUid: 'table', referencePath: [] };
    const useCase = new TablePersonalizations(gateway(['reader']), repository, '1');
    const before: Model[] = await database.getRepository('flowModels').find();
    const record = await database
      .getRepository('records')
      .create({ values: { first: 'Первое', extra: 'Реальные данные' } });
    const loaded = await useCase.execute('get', { identity });
    const selected = loaded.columns.map((column) => column.uid);
    const saved = await useCase.execute('save', {
      identity,
      schemaSignature: loaded.schemaSignature,
      settings: { version: 1, columnOrder: selected, hiddenColumnUids: [] },
    });
    expect(saved.settings?.columnOrder).toEqual(selected);
    expect((await useCase.execute('get', { identity })).settings).toEqual(saved.settings);
    expect(
      (await new TablePersonalizations(gateway(['reader']), repository, '2').execute('get', { identity })).settings,
    ).toBeNull();
    const after: Model[] = await database.getRepository('flowModels').find();
    expect(after.map((model) => model.toJSON())).toEqual(before.map((model) => model.toJSON()));
    expect((await database.getRepository('records').findOne({ filterByTk: record.get('id') })).get('extra')).toBe(
      'Реальные данные',
    );
    await useCase.execute('reset', { identity });
    await useCase.execute('reset', { identity });
    expect((await useCase.execute('get', { identity })).settings).toBeNull();
  });

  it('excludes extra associations when their title field cannot be read and rejects write-only access', async () => {
    can.mockImplementation(({ resource }: { resource: string }) => ({
      params: resource === 'records' ? { appends: ['department'] } : { except: ['name'] },
    }));
    expect((await gateway(['reader']).authorize({ tableUid: 'table', referencePath: [] })).columns).toEqual([]);
    can.mockImplementation(({ action }: { action: string }) =>
      action === 'update' || action === 'destroy' ? { params: {} } : null,
    );
    await expect(gateway(['reader']).authorize({ tableUid: 'table', referencePath: [] })).rejects.toThrow('FORBIDDEN');
  });

  it('rejects a forged hidden field and changes the signature when the collection schema changes', async () => {
    can.mockReturnValue({ params: { fields: ['first', 'extra'] } });
    const identity = { tableUid: 'table', referencePath: [] };
    const useCase = new TablePersonalizations(gateway(['reader']), repository, '1');
    const loaded = await useCase.execute('get', { identity });
    await expect(
      useCase.execute('save', {
        identity,
        schemaSignature: loaded.schemaSignature,
        settings: { version: 1, columnOrder: ['secret'], hiddenColumnUids: [] },
      }),
    ).rejects.toThrow('FORBIDDEN');
    database
      .getCollection('records')
      .setField('extra', { type: 'string', interface: 'textarea', uiSchema: { title: 'Изменённое поле' } });
    await expect(
      useCase.execute('save', { identity, schemaSignature: loaded.schemaSignature, settings }),
    ).rejects.toThrow('SCHEMA_CHANGED');
  });

  it('locks concurrent width and layout mutations without losing unrelated preferences', async () => {
    can.mockReturnValue({ params: {} });
    const identity = { tableUid: 'table', referencePath: [] };
    const useCase = new TablePersonalizations(gateway(), repository, '1');
    const loaded = await useCase.execute('get', { identity });
    const before: Model[] = await database.getRepository('flowModels').find();
    const businessBefore = await database.getRepository('records').find();
    const layout = { version: 1 as const, columnOrder: ['second', 'first'], hiddenColumnUids: ['first'] };
    await Promise.all([
      useCase.execute('width', { identity, columnUid: 'first', width: 210, schemaSignature: loaded.schemaSignature }),
      useCase.execute('width', { identity, columnUid: 'second', width: 310, schemaSignature: loaded.schemaSignature }),
      useCase.execute('save', { identity, settings: layout, schemaSignature: loaded.schemaSignature }),
    ]);
    const result = await useCase.execute('get', { identity });
    expect(result.settings?.columnWidths).toEqual({ first: 210, second: 310 });
    expect(result.settings?.columnOrder.filter((uid) => ['first', 'second'].includes(uid))).toEqual([
      'second',
      'first',
    ]);
    expect(result.settings?.hiddenColumnUids).toContain('first');
    await useCase.execute('width', {
      identity,
      columnUid: 'first',
      width: null,
      schemaSignature: loaded.schemaSignature,
    });
    expect((await useCase.execute('get', { identity })).settings?.columnWidths).toEqual({ second: 310 });
    expect(
      (await new TablePersonalizations(gateway(), repository, '2').execute('get', { identity })).settings,
    ).toBeNull();
    expect((await database.getRepository('flowModels').find()).map((model: Model) => model.toJSON())).toEqual(
      before.map((model) => model.toJSON()),
    );
    expect((await database.getRepository('records').find()).map((model: Model) => model.toJSON())).toEqual(
      businessBefore.map((model: Model) => model.toJSON()),
    );
    await useCase.execute('reset', { identity });
  });

  it.each(['TableSelectModel', 'SubTableFieldModel', 'DisplaySubTableFieldModel', 'PopupSubTableFieldModel'])(
    'authorizes native %s widths through saved resources and association bindings',
    async (use) => {
      const uid = `width_${use}`;
      const isSelect = use === 'TableSelectModel';
      const columnUid = `${uid}_name`;
      const columnUse = use === 'SubTableFieldModel' ? 'SubTableColumnModel' : 'TableColumnModel';
      const subKey = use === 'PopupSubTableFieldModel' ? 'subTableColumns' : 'columns';
      const models = [
        {
          uid: `${uid}_parent`,
          options: {
            use: 'FormItemModel',
            stepParams: { fieldSettings: { init: { collectionName: 'records', fieldPath: 'department' } } },
          },
        },
        {
          uid,
          options: {
            use,
            parentId: `${uid}_parent`,
            stepParams: isSelect ? { resourceSettings: { init: { collectionName: 'departments' } } } : {},
          },
        },
        {
          uid: columnUid,
          options: {
            use: columnUse,
            parentId: uid,
            subKey,
            stepParams: {
              fieldSettings: {
                init: {
                  collectionName: isSelect ? 'departments' : 'records',
                  fieldPath: isSelect ? 'name' : 'department.name',
                },
              },
            },
          },
        },
      ];
      await database.getRepository('flowModels').create({ values: models });
      await database
        .getRepository('flowModelTreePath')
        .create({ values: { ancestor: 'page', descendant: uid, depth: 1 } });
      try {
        can.mockReturnValue({ params: {} });
        const identity = { tableUid: uid, referencePath: [] };
        const useCase = new TablePersonalizations(gateway(['reader']), repository, '1');
        const loaded = await useCase.execute('get', { identity });
        expect(loaded.resizableColumnUids).toContain(columnUid);
        expect(
          (await useCase.execute('width', { identity, columnUid, width: 280, schemaSignature: loaded.schemaSignature }))
            .settings?.columnWidths,
        ).toEqual({ [columnUid]: 280 });
        can.mockImplementation(({ resource }: { resource: string }) => ({
          params: resource === 'departments' ? { except: ['name'] } : {},
        }));
        const restricted = await useCase.execute('get', { identity });
        expect(restricted.resizableColumnUids).not.toContain(columnUid);
        expect(restricted.settings?.columnWidths).toEqual({});
        await expect(
          useCase.execute('width', { identity, columnUid, width: 290, schemaSignature: restricted.schemaSignature }),
        ).rejects.toThrow('FORBIDDEN');
        if (!isSelect) {
          can.mockImplementation(({ resource }: { resource: string }) =>
            resource === 'records' ? { params: { except: ['department'] } } : { params: {} },
          );
          await expect(useCase.execute('get', { identity })).rejects.toThrow('FORBIDDEN');
        }
      } finally {
        await database.getRepository('flowModels').destroy({ filterByTk: models.map((model) => model.uid) });
        await database.getRepository('flowModelTreePath').destroy({ filter: { descendant: uid } });
      }
    },
  );

  it('authorizes native actions and JS widths while preserving field ACL and reference isolation', async () => {
    const uses = ['TableActionsColumnModel', 'JSColumnModel'];
    await database
      .getRepository('flowModels')
      .create({ values: uses.map((use) => ({ uid: use, options: { use, parentId: 'table', subKey: 'columns' } })) });
    try {
      can.mockReturnValue({ params: { fields: ['first'] } });
      const identity = { tableUid: 'table', referencePath: [] };
      const useCase = new TablePersonalizations(gateway(['reader']), repository, '1');
      const loaded = await useCase.execute('get', { identity });
      expect(loaded.resizableColumnUids).toEqual(expect.arrayContaining(uses));
      expect(loaded.resizableColumnUids).not.toContain('second');
      for (const columnUid of uses)
        await useCase.execute('width', { identity, columnUid, width: 180, schemaSignature: loaded.schemaSignature });
      expect((await useCase.execute('get', { identity })).settings?.columnWidths).toEqual({
        TableActionsColumnModel: 180,
        JSColumnModel: 180,
      });
      expect(
        (await useCase.execute('get', { identity: { ...identity, referencePath: ['ref-one'] } })).settings,
      ).toBeNull();
      await useCase.execute('reset', { identity });
    } finally {
      await database.getRepository('flowModels').destroy({ filterByTk: uses });
    }
  });

  it('cascades user, reference placement and table deletion', async () => {
    const initializations = database.getRepository(TEMPLATE_INITIALIZATIONS_COLLECTION);
    await repository.save(owner('3', 'user-deletion'), settings);
    await database.getRepository('users').destroy({ filterByTk: '3' });
    expect(await repository.find(owner('3', 'user-deletion'))).toBeNull();
    expect(await initializations.count({ filter: { userId: '3' } })).toBe(0);
    await repository.save(owner('1', 'reference-deletion', 'ref-one'), settings);
    await database.getRepository('flowModels').destroy({ filterByTk: 'ref-one' });
    expect(await repository.find(owner('1', 'reference-deletion', 'ref-one'))).toBeNull();
    await database.getRepository('flowModels').destroy({ filterByTk: 'table' });
    expect(await database.getRepository('lc_table_personalizations').count()).toBe(0);
    await database.getRepository('flowModels').destroy({ filterByTk: 'status-table' });
    expect(await initializations.count()).toBe(0);
  });
});
