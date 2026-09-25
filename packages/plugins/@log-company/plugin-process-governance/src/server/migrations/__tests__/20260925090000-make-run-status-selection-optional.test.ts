/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import MakeRunStatusSelectionOptional from '../20260925090000-make-run-status-selection-optional';

type MigrationContext = ConstructorParameters<typeof MakeRunStatusSelectionOptional>[0];

function migrationContext(hasStatus = true) {
  const update = vi.fn().mockResolvedValue(undefined);
  const repository = {
    findOne: vi.fn().mockResolvedValue(
      hasStatus
        ? {
            get: () => ({
              defaultValue: 'queue',
              validation: {
                type: 'string',
                rules: [
                  { key: 'transport_run_status_required', name: 'required' },
                  { key: 'transport_run_status_custom', name: 'custom' },
                ],
              },
              uiSchema: { title: 'Статус', required: true, 'x-component': 'Select' },
            }),
            update,
          }
        : null,
    ),
  };
  const database = { getRepository: vi.fn(() => repository) };
  return {
    migration: new MakeRunStatusSelectionOptional({ db: database } as unknown as MigrationContext),
    repository,
    update,
  };
}

describe('MakeRunStatusSelectionOptional migration', () => {
  it('removes only the required metadata and preserves the queue default', async () => {
    const setup = migrationContext();

    await setup.migration.up();

    expect(setup.repository.findOne).toHaveBeenCalledWith({
      filter: { collectionName: 'transport_runs', name: 'status' },
    });
    expect(setup.update).toHaveBeenCalledWith({
      options: {
        defaultValue: 'queue',
        validation: {
          type: 'string',
          rules: [{ key: 'transport_run_status_custom', name: 'custom' }],
        },
        uiSchema: { title: 'Статус', 'x-component': 'Select' },
      },
    });
  });

  it('fails safely when the status metadata is missing', async () => {
    const setup = migrationContext(false);

    await expect(setup.migration.up()).rejects.toThrow('В коллекции transport_runs отсутствует поле status.');
    expect(setup.update).not.toHaveBeenCalled();
  });
});
