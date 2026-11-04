/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import RefreshWorkspaceFields from '../20261029091000-refresh-logistics-workspace-fields';

describe('workspace field metadata upgrade', () => {
  it('corrects existing field types while retaining user titles and creates hidden source links', async () => {
    const update = vi.fn(async () => undefined);
    const create = vi.fn(async () => undefined);
    const fields = {
      findOne: vi.fn(async ({ filter }: { filter: { name: string } }) =>
        filter.name === 'run_number'
          ? {
              get: () => ({ uiSchema: { title: 'Мой номер рейса', type: 'string', 'x-component': 'Input' } }),
              update,
            }
          : null,
      ),
      create,
    };
    const migration = new RefreshWorkspaceFields({
      db: { getRepository: () => fields },
    } as unknown as ConstructorParameters<typeof RefreshWorkspaceFields>[0]);
    await migration.up();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        interface: 'integer',
        options: expect.objectContaining({
          uiSchema: expect.objectContaining({
            type: 'number',
            'x-component': 'InputNumber',
            title: 'Мой номер рейса',
          }),
        }),
      }),
    );
    expect(create).toHaveBeenCalledWith({
      values: expect.objectContaining({
        collectionName: 'logistics_work_items',
        name: 'run',
        type: 'belongsTo',
        target: 'transport_runs',
        hidden: true,
      }),
    });
    expect(create).toHaveBeenCalledWith({
      values: expect.objectContaining({
        name: 'customs_scheme',
        interface: 'select',
      }),
    });
    expect(fields.findOne).toHaveBeenCalledTimes(7);
  });
});
