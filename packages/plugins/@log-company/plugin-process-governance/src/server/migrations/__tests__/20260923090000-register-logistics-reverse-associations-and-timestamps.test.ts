/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import RegisterLogisticsMetadata from '../20260923090000-register-logistics-reverse-associations-and-timestamps';

type MigrationContext = ConstructorParameters<typeof RegisterLogisticsMetadata>[0];

interface MigrationSetupOptions {
  existingFields?: boolean;
  missingCollection?: string;
}

function metadataModel(values: Record<string, unknown>) {
  return {
    get: vi.fn((name: string) => values[name]),
    update: vi.fn().mockResolvedValue(undefined),
  };
}

function migrationContext(options: MigrationSetupOptions = {}) {
  const updateField = vi.fn().mockResolvedValue(undefined);
  const createField = vi.fn().mockResolvedValue(undefined);
  const destroyField = vi.fn().mockResolvedValue(1);
  const legacyField = metadataModel({
    collectionName: 'chinese_clients',
    name: 'customs_processes',
    options: { target: 'customs_processes' },
  });
  const shipmentField = metadataModel({
    collectionName: 'chinese_clients',
    name: 'shipments',
    options: { target: 'shipments' },
  });
  const fieldsRepository = {
    find: vi.fn().mockResolvedValue([legacyField, shipmentField]),
    findOne: vi.fn().mockResolvedValue(options.existingFields ? { get: vi.fn(), update: updateField } : null),
    create: createField,
    destroy: destroyField,
  };
  const collectionsRepository = {
    findOne: vi.fn(({ filter }: { filter: { name: string } }) =>
      Promise.resolve(filter.name === options.missingCollection ? null : { name: filter.name }),
    ),
  };
  const database = {
    getRepository: vi.fn((name: string) => (name === 'fields' ? fieldsRepository : collectionsRepository)),
  };

  return {
    migration: new RegisterLogisticsMetadata({ db: database } as unknown as MigrationContext),
    collectionsRepository,
    createField,
    destroyField,
    updateField,
  };
}

describe('RegisterLogisticsMetadata migration', () => {
  it('registers reverse shipment relations and Russian timestamp fields', async () => {
    const setup = migrationContext();

    await setup.migration.up();

    expect(setup.createField).toHaveBeenCalledWith({
      values: expect.objectContaining({
        collectionName: 'chinese_clients',
        name: 'shipments',
        type: 'hasMany',
        interface: 'o2m',
        target: 'shipments',
        foreignKey: 'chinese_client_id',
      }),
    });
    expect(setup.createField).toHaveBeenCalledWith({
      values: expect.objectContaining({
        collectionName: 'our_companies',
        name: 'shipments',
        type: 'hasMany',
        target: 'shipments',
        foreignKey: 'company_id',
      }),
    });
    expect(setup.createField).toHaveBeenCalledWith({
      values: expect.objectContaining({
        collectionName: 'transport_runs',
        name: 'createdAt',
        type: 'date',
        interface: 'createdAt',
        uiSchema: expect.objectContaining({ title: 'Дата создания' }),
      }),
    });
    expect(setup.createField).toHaveBeenCalledWith({
      values: expect.objectContaining({
        collectionName: 'shipments',
        name: 'updatedAt',
        type: 'date',
        interface: 'updatedAt',
        uiSchema: expect.objectContaining({ title: 'Дата обновления' }),
      }),
    });
    expect(setup.createField).toHaveBeenCalledWith({
      values: expect.objectContaining({
        collectionName: 'shipment_history',
        name: 'createdAt',
        interface: 'createdAt',
      }),
    });
    expect(setup.createField).not.toHaveBeenCalledWith({
      values: expect.objectContaining({ collectionName: 'shipment_history', name: 'updatedAt' }),
    });
    expect(setup.destroyField).toHaveBeenCalledOnce();
    expect(setup.destroyField).toHaveBeenCalledWith({
      filter: { collectionName: 'chinese_clients', name: 'customs_processes' },
    });
  });

  it('updates existing metadata without creating duplicates', async () => {
    const setup = migrationContext({ existingFields: true });

    await setup.migration.up();

    expect(setup.createField).not.toHaveBeenCalled();
    expect(setup.updateField).toHaveBeenCalledTimes(12);
  });

  it('fails before writing metadata when a required collection is missing', async () => {
    const setup = migrationContext({ missingCollection: 'our_companies' });

    await expect(setup.migration.up()).rejects.toThrow(
      'Для настройки логистических полей отсутствует коллекция our_companies.',
    );
    expect(setup.createField).not.toHaveBeenCalled();
    expect(setup.destroyField).not.toHaveBeenCalled();
  });
});
