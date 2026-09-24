/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import AllowLogisticsTimestamps from '../20260923091000-allow-logistics-timestamps';

type MigrationContext = ConstructorParameters<typeof AllowLogisticsTimestamps>[0];

function model(values: Record<string, unknown>) {
  return {
    id: values.id as string | undefined,
    get: vi.fn((name: string) => values[name]),
    update: vi.fn().mockResolvedValue(undefined),
  };
}

describe('AllowLogisticsTimestamps migration', () => {
  it('adds both timestamps to existing view permissions without removing configured fields', async () => {
    const resourcesRepository = {
      findOne: vi.fn().mockResolvedValue(model({ id: 'resource-id' })),
    };
    const action = model({ fields: ['run_number', 'createdAt'] });
    const actionsRepository = { findOne: vi.fn().mockResolvedValue(action) };
    const database = {
      getRepository: vi.fn((name: string) =>
        name === 'dataSourcesRolesResources' ? resourcesRepository : actionsRepository,
      ),
    };
    const migration = new AllowLogisticsTimestamps({ db: database } as unknown as MigrationContext);

    await migration.up();

    expect(action.update).toHaveBeenCalledTimes(8);
    expect(action.update).toHaveBeenCalledWith({ fields: ['run_number', 'createdAt', 'updatedAt'] });
  });

  it('leaves unrestricted or missing ACL records unchanged', async () => {
    const unrestrictedAction = model({ fields: null });
    const resourcesRepository = {
      findOne: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValue(model({ id: 'resource-id' })),
    };
    const actionsRepository = { findOne: vi.fn().mockResolvedValue(unrestrictedAction) };
    const database = {
      getRepository: vi.fn((name: string) =>
        name === 'dataSourcesRolesResources' ? resourcesRepository : actionsRepository,
      ),
    };
    const migration = new AllowLogisticsTimestamps({ db: database } as unknown as MigrationContext);

    await migration.up();

    expect(unrestrictedAction.update).not.toHaveBeenCalled();
  });
});
