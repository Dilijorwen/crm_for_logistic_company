/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ACL } from '@nocobase/acl';
import actions from '@nocobase/actions';
import { createMockDatabase, type Database } from '@nocobase/database';
import PluginACLServer from '@nocobase/plugin-acl';
import { Resourcer } from '@nocobase/resourcer';
import type { Plugin } from '@nocobase/server';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import supertest from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidateRunParents } from '../../../application/logistics/ValidateRunParents';
import { ValidateShipmentDeletion } from '../../../application/logistics/ValidateShipmentDeletion';
import type { LogisticsRepository } from '../../../application/logistics/ports/LogisticsRepository';
import { LogisticsPreActions } from '../LogisticsPreActions';

type PreActionHandler = (
  context: {
    can?: () => { params?: { filter?: Record<string, unknown> } } | null;
    action: {
      actionName: string;
      params: Record<string, unknown>;
    };
  },
  next: () => Promise<unknown>,
) => Promise<void>;

describe('LogisticsPreActions database integration', () => {
  let db: Database;

  beforeEach(async () => {
    db = await createMockDatabase();
    await db.clean({ drop: true });
    db.collection({ name: 'transport_run_shipments', timestamps: false });
    db.collection({ name: 'our_companies' });
    db.collection({ name: 'contracts' });
    db.collection({
      name: 'shipments',
      fields: [
        { type: 'string', name: 'display_name' },
        { type: 'string', name: 'private_note' },
        { type: 'belongsTo', name: 'company', target: 'our_companies', foreignKey: 'company_id' },
        { type: 'belongsTo', name: 'contract_record', target: 'contracts', foreignKey: 'contract_id' },
        {
          type: 'belongsToMany',
          name: 'runs',
          target: 'transport_runs',
          through: 'transport_run_shipments',
          foreignKey: 'shipment_id',
          otherKey: 'transport_run_id',
        },
      ],
    });
    db.collection({
      name: 'transport_runs',
      fields: [
        {
          type: 'belongsToMany',
          name: 'shipments',
          target: 'shipments',
          through: 'transport_run_shipments',
          foreignKey: 'transport_run_id',
          otherKey: 'shipment_id',
        },
      ],
    });
    await db.sync();
  });

  afterEach(async () => {
    await db.close();
  });

  function registerPreActions(resourcer: object) {
    const plugin = { db, app: { resourcer } } as unknown as Plugin;
    const repository = {
      getRunParentIds: vi.fn(async () => []),
      lockRunParentGraph: vi.fn(async () => undefined),
      runParentSelectionCreatesCycle: vi.fn(async () => false),
      countShipmentRunLinks: vi.fn(async () => 0),
    } as unknown as LogisticsRepository;
    new LogisticsPreActions(
      plugin,
      repository,
      new ValidateRunParents(repository),
      new ValidateShipmentDeletion(repository),
    ).register();
  }

  function registerHandlers(genericHandlers: PreActionHandler[] = []) {
    const handlers = new Map<string, PreActionHandler>();
    registerPreActions({
      registerPreActionHandler: (name: string, handler: PreActionHandler) => handlers.set(name, handler),
      getRegisteredPreActionHandlers: () => genericHandlers,
    });
    return handlers;
  }

  it('creates a shipment linked to its run and preserves the link on subsequent edits', async () => {
    const handlers = registerHandlers();
    const run = await db.getRepository('transport_runs').create({ values: {} });
    const createParams = {
      values: {
        display_name: 'Новая поставка',
        runs: [{ id: run.get('id'), transport_run_shipments: { transport_run_id: undefined } }],
      },
      updateAssociationValues: ['runs'],
    };
    let shipmentId: unknown;
    await handlers.get('shipments:create')?.({ action: { actionName: 'create', params: createParams } }, async () => {
      shipmentId = (await db.getRepository('shipments').create(createParams)).get('id');
    });
    expect(
      (await db.getRepository('transport_runs.shipments', run.get('id')).find()).map((item) => item.get('id')),
    ).toEqual([shipmentId]);
    const updateParams = {
      filterByTk: shipmentId,
      values: { display_name: 'Исправленная поставка', runs: [{ id: run.get('id'), shipments: [{}] }] },
      updateAssociationValues: ['runs', 'runs.shipments'],
    };
    await handlers.get('shipments:update')?.({ action: { actionName: 'update', params: updateParams } }, async () => {
      await db.getRepository('shipments').update(updateParams);
    });
    expect(
      (await db.getRepository('transport_runs.shipments', run.get('id')).find()).map((item) =>
        item.get('display_name'),
      ),
    ).toEqual(['Исправленная поставка']);
  });

  it('keeps the current shipment values while saving a run with a stale shipment snapshot', async () => {
    const handlers = registerHandlers();

    const run = await db.getRepository('transport_runs').create({ values: {} });
    const shipment = await db.getRepository('shipments').create({ values: { display_name: 'Актуальное название' } });
    const params: Record<string, unknown> = {
      filterByTk: run.get('id'),
      values: {
        shipments: [{ id: shipment.get('id'), display_name: 'Устаревшее название' }],
      },
      updateAssociationValues: ['shipments'],
    };
    const handler = handlers.get('transport_runs:update');
    if (!handler) {
      throw new Error('transport_runs:update pre-action was not registered');
    }

    await handler({ action: { actionName: 'update', params } }, async () => {
      await db.getRepository('transport_runs').update(params);
    });

    const persistedShipment = await db.getRepository('shipments').findOne({ filterByTk: shipment.get('id') });
    const linkedShipments = await db.getRepository('transport_runs.shipments', run.get('id')).find();
    expect(persistedShipment?.get('display_name')).toBe('Актуальное название');
    expect(linkedShipments.map((record) => record.get('id'))).toEqual([shipment.get('id')]);
  });

  it('links selected shipments and edits the original row under a field-limited role', async () => {
    const acl = new ACL();
    acl.define({ role: 'operator', actions: { 'shipments:update': { whitelist: ['display_name'] } } });
    const handlers = registerHandlers([
      async ({ action }, next) => {
        action.params.values = await PluginACLServer.prototype.sanitizeAssociationValues({
          acl,
          roles: ['operator'],
          db,
          resourceName: 'transport_runs',
          actionName: action.actionName,
          values: action.params.values,
          updateAssociationValues: ['shipments'],
          aclParams: { whitelist: ['shipments'] },
        });
        await next();
      },
    ]);
    const runs = db.getRepository('transport_runs');
    const shipments = db.getRepository('shipments');
    const run = await runs.create({ values: {} });
    const selected = await shipments.create({ values: { display_name: 'Исходная поставка' } });
    const edited = await shipments.create({
      values: { display_name: 'Другая поставка', private_note: 'Исходная заметка' },
    });
    const params = {
      workspaceUnified: true,
      filterByTk: run.get('id'),
      updateAssociationValues: ['shipments'],
      values: {
        shipments: [
          String(selected.get('id')),
          { id: String(edited.get('id')), display_name: 'Уточнённая поставка', private_note: 'Изменённая заметка' },
        ],
      },
    };
    await handlers.get('transport_runs:update')?.({ action: { actionName: 'update', params } }, async () => {
      await runs.update(params);
    });

    expect(await shipments.count()).toBe(2);
    const linked = await db.getRepository('transport_runs.shipments', run.get('id')).find();
    expect(linked.map((shipment) => [shipment.get('id'), shipment.get('display_name')])).toEqual(
      expect.arrayContaining([
        [selected.get('id'), 'Исходная поставка'],
        [edited.get('id'), 'Уточнённая поставка'],
      ]),
    );
    expect(linked).toHaveLength(2);
    expect((await shipments.findOne({ filterByTk: edited.get('id') })).get('private_note')).toBe('Исходная заметка');
  });

  it('rejects linking a shipment outside the read scope', async () => {
    const handlers = registerHandlers([
      async (_context, next) => {
        await next();
      },
    ]);
    const shipment = await db.getRepository('shipments').create({ values: { display_name: 'Закрытая поставка' } });
    const write = vi.fn();
    await expect(
      handlers.get('transport_runs:update')?.(
        {
          can: () => ({ params: { filter: { display_name: 'Доступная поставка' } } }),
          action: {
            actionName: 'update',
            params: {
              workspaceUnified: true,
              updateAssociationValues: ['shipments'],
              values: { shipments: [shipment.get('id')] },
            },
          },
        },
        write,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(write).not.toHaveBeenCalled();
  });

  it('creates a run with new and selected shipments together and can attach more than two', async () => {
    const acl = new ACL();
    const role = acl.define({
      role: 'operator',
      actions: {
        'shipments:create': { whitelist: ['display_name'] },
        'shipments:update': { whitelist: ['display_name'] },
      },
    });
    const resourcer = new Resourcer({ prefix: '/api' });
    const authorizeAssociations: Parameters<Resourcer['registerPreActionHandler']>[1] = async ({ action }, next) => {
      action.params.whitelist = ['shipments'];
      action.params.values = await PluginACLServer.prototype.sanitizeAssociationValues({
        acl,
        roles: ['operator'],
        db,
        resourceName: 'transport_runs',
        actionName: action.actionName,
        values: action.params.values,
        updateAssociationValues: action.params.updateAssociationValues,
        aclParams: { whitelist: action.params.whitelist },
      });
      await next();
    };
    resourcer.registerPreActionHandler('create', authorizeAssociations);
    resourcer.registerPreActionHandler('update', authorizeAssociations);
    registerPreActions(resourcer);
    resourcer.define({ name: 'transport_runs', actions: { create: actions.create, update: actions.update } });
    const app = new Koa();
    app.context.db = db;
    app.use(bodyParser());
    app.use(resourcer.middleware());
    const agent = supertest(app.callback());
    const query = 'workspaceUnified=true&updateAssociationValues%5B%5D=shipments';
    const shipments = db.getRepository('shipments');
    const company = await db.getRepository('our_companies').create({ values: {} });
    const contract = await db.getRepository('contracts').create({ values: {} });
    const first = await shipments.create({
      values: {
        display_name: 'Первая поставка',
        private_note: 'Существующие данные',
        company: company.get('id'),
        contract_record: contract.get('id'),
      },
    });

    const draftsSeen: unknown[] = [];
    db.on('shipments.afterCreate', (_model, options) => {
      if (options.inputValues?._workspaceShipmentDocuments)
        draftsSeen.push(options.inputValues._workspaceShipmentDocuments);
    });
    const created = await agent.post(`/api/transport_runs:create?${query}`).send({
      shipments: [
        { display_name: 'Новая при создании рейса', _workspaceShipmentDocuments: ['draft-first'] },
        { id: first.get('id') },
      ],
    });
    expect(created.status).toBe(200);
    const runId = created.body.id;
    const linked = db.getRepository('transport_runs.shipments', runId);
    expect(await linked.count()).toBe(2);
    const savedShipment = await shipments.findOne({ filterByTk: first.get('id') });
    expect(savedShipment.get('company_id')).toBe(company.get('id'));
    expect(savedShipment.get('contract_id')).toBe(contract.get('id'));
    expect(savedShipment.get('private_note')).toBe('Существующие данные');
    const more = await shipments.create({ values: { display_name: 'Третья поставка' } });
    const updated = await agent
      .post(`/api/transport_runs:update/${runId}?${query}`)
      .send({ shipments: [{ id: more.get('id') }, { display_name: 'Четвёртая поставка' }] });
    expect(updated.status).toBe(200);
    expect((await linked.find()).map((row) => row.get('display_name'))).toEqual(
      expect.arrayContaining(['Первая поставка', 'Новая при создании рейса', 'Третья поставка', 'Четвёртая поставка']),
    );
    expect(await linked.count()).toBe(4);
    expect(draftsSeen).toEqual([['draft-first']]);
    role.revokeAction('shipments:create');
    const blocked = await agent
      .post(`/api/transport_runs:create?${query}`)
      .send({ shipments: [{ display_name: 'Недоступная новая поставка' }] });
    expect(blocked.status).toBe(403);
    expect(await db.getRepository('transport_runs').count()).toBe(1);
  });
});
