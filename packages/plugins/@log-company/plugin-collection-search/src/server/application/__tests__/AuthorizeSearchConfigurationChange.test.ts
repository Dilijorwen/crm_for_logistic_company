/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { AuthorizeSearchConfigurationChange } from '../AuthorizeSearchConfigurationChange';
import type { SearchFlowModelRepository } from '../ports/SearchFlowModelRepository';

class FlowModelRepositoryStub implements SearchFlowModelRepository {
  constructor(private readonly containsSearchModel: boolean) {}

  async containsSearchAction() {
    return this.containsSearchModel;
  }
}

describe('AuthorizeSearchConfigurationChange', () => {
  it('allows root to create and update search actions', async () => {
    const authorize = new AuthorizeSearchConfigurationChange(new FlowModelRepositoryStub(true));

    await expect(
      authorize.execute({
        roles: ['root'],
        payload: { use: 'CollectionSearchActionModel' },
        modelUids: ['search-action'],
      }),
    ).resolves.toBeUndefined();
  });

  it('forbids a regular user from creating or modifying a search action', async () => {
    const createAuthorization = new AuthorizeSearchConfigurationChange(new FlowModelRepositoryStub(false));
    const updateAuthorization = new AuthorizeSearchConfigurationChange(new FlowModelRepositoryStub(true));

    await expect(
      createAuthorization.execute({
        roles: ['member'],
        payload: { subModels: { actions: [{ use: 'CollectionSearchActionModel' }] } },
        modelUids: [],
      }),
    ).rejects.toMatchObject({ name: 'SearchConfigurationForbiddenError' });
    await expect(
      updateAuthorization.execute({ roles: ['member'], modelUids: ['search-action'] }),
    ).rejects.toMatchObject({ name: 'SearchConfigurationForbiddenError' });
  });

  it('does not restrict unrelated FlowEngine models', async () => {
    const authorize = new AuthorizeSearchConfigurationChange(new FlowModelRepositoryStub(false));

    await expect(
      authorize.execute({ roles: ['member'], payload: { use: 'RefreshActionModel' }, modelUids: ['refresh-action'] }),
    ).resolves.toBeUndefined();
  });
});
