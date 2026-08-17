/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import supertest from 'supertest';
import { Application } from '../application';

describe('i18next', () => {
  let app: Application;
  let agent: supertest.SuperAgentTest;

  beforeEach(() => {
    app = new Application({
      database: {
        dialect: 'sqlite',
        storage: ':memory:',
      },
      resourcer: {
        prefix: '/api',
      },
      acl: false,
      dataWrapping: false,
      registerActions: false,
      skipSupervisor: true,
    });
    app.i18n.addResources('ru-RU', 'translation', {
      hello: 'Привет',
    });
    app.i18n.addResources('en-US', 'translation', {
      hello: 'Hello',
    });
    agent = supertest.agent(app.callback());
  });

  afterEach(async () => {
    return app.destroy();
  });

  it('global', async () => {
    expect(app.i18n.t('hello')).toEqual('Hello');
    app.i18n.changeLanguage('ru-RU');
    expect(app.i18n.t('hello')).toEqual('Привет');
  });

  it('ctx', async () => {
    app.resource({
      name: 'tests',
      actions: {
        get: async (ctx, next) => {
          ctx.body = ctx.t('hello');
          await next();
        },
      },
    });
    const response1 = await agent.get('/api/tests:get');
    expect(response1.text).toEqual('Hello');
    const response2 = await agent.get('/api/tests:get').set('X-Locale', 'ru-RU');
    expect(response2.text).toEqual('Привет');
    const response3 = await agent.get('/api/tests:get?locale=ru-RU');
    expect(response3.text).toEqual('Привет');
    expect(app.i18n.language).toBe('en-US');
  });
});
