/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import AcceptCommaDecimals from '../20260924090000-accept-comma-decimals';

type MigrationContext = ConstructorParameters<typeof AcceptCommaDecimals>[0];

function migrationContext(missingField?: string) {
  const update = vi.fn().mockResolvedValue(undefined);
  const repository = {
    findOne: vi.fn(({ filter }: { filter: { name: string } }) =>
      Promise.resolve(
        filter.name === missingField
          ? null
          : {
              get: () => ({
                validate: { min: 0 },
                uiSchema: {
                  title: 'Сумма',
                  'x-component-props': { step: '0.01', stringMode: true },
                },
              }),
              update,
            },
      ),
    ),
  };
  const database = { getRepository: vi.fn(() => repository) };
  return {
    migration: new AcceptCommaDecimals({ db: database } as unknown as MigrationContext),
    repository,
    update,
  };
}

describe('AcceptCommaDecimals migration', () => {
  it('adds the comma separator without losing existing field metadata', async () => {
    const setup = migrationContext();

    await setup.migration.up();

    expect(setup.update).toHaveBeenCalledTimes(6);
    expect(setup.update).toHaveBeenCalledWith({
      options: {
        validate: { min: 0 },
        uiSchema: {
          title: 'Сумма',
          'x-component-props': { step: '0.01', stringMode: true, decimalSeparator: ',' },
        },
      },
    });
  });

  it('fails safely when expected shipment metadata is missing', async () => {
    const setup = migrationContext('eco_fee');

    await expect(setup.migration.up()).rejects.toThrow('В коллекции shipments отсутствует числовое поле eco_fee.');
  });
});
