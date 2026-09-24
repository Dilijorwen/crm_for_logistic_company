/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import AddPermitDocumentName from '../20260916010000-add-permit-document-name';

type MigrationContext = ConstructorParameters<typeof AddPermitDocumentName>[0];

function migrationContext(options: { columnExists?: boolean; fieldExists?: boolean; collectionExists?: boolean } = {}) {
  const transaction = { id: 'transaction' };
  const rows = [
    {
      id: '1',
      title: 'DOC-1',
      document_type: 'declaration_of_conformity',
      valid_from: '2026-08-24',
      valid_until: '2027-08-23',
    },
    {
      id: '2',
      title: 'SGR-1',
      document_type: 'state_registration_certificate',
      valid_from: new Date('2026-08-27T00:00:00.000Z'),
      valid_until: null,
    },
  ];
  const addColumn = vi.fn().mockResolvedValue(undefined);
  const changeColumn = vi.fn().mockResolvedValue(undefined);
  const updateField = vi.fn().mockResolvedValue(undefined);
  const createField = vi.fn().mockResolvedValue(undefined);
  const updateCollection = vi.fn().mockResolvedValue(undefined);
  const query = vi.fn().mockImplementation((sql: string) => {
    return Promise.resolve(sql.startsWith('select id') ? [rows, undefined] : [undefined, undefined]);
  });
  const fieldsRepository = {
    findOne: vi.fn().mockResolvedValue(options.fieldExists === false ? null : { update: updateField }),
    create: createField,
  };
  const collectionsRepository = {
    findOne: vi.fn().mockResolvedValue(options.collectionExists === false ? null : { update: updateCollection }),
  };
  const database = {
    sequelize: {
      getQueryInterface: () => ({
        describeTable: vi.fn().mockResolvedValue(options.columnExists === false ? {} : { name: {} }),
        addColumn,
        changeColumn,
      }),
      transaction: vi.fn((callback: (value: unknown) => Promise<void>) => callback(transaction)),
      query,
    },
    getRepository: vi.fn((name: string) => (name === 'fields' ? fieldsRepository : collectionsRepository)),
  };
  return {
    migration: new AddPermitDocumentName({ db: database } as unknown as MigrationContext),
    transaction,
    query,
    addColumn,
    changeColumn,
    updateField,
    createField,
    updateCollection,
  };
}

describe('AddPermitDocumentName migration', () => {
  it('adds, backfills and registers the generated name field', async () => {
    const setup = migrationContext({ columnExists: false });

    await setup.migration.up();

    expect(setup.addColumn).toHaveBeenCalledWith(
      'permit_documents',
      'name',
      expect.objectContaining({ allowNull: true }),
      { transaction: setup.transaction },
    );
    expect(setup.query).toHaveBeenCalledWith('update permit_documents set name = :name where id = :id', {
      replacements: { id: '1', name: 'DOC-1 от 24.08.2026 до 23.08.2027' },
      transaction: setup.transaction,
    });
    expect(setup.query).toHaveBeenCalledWith('update permit_documents set name = :name where id = :id', {
      replacements: { id: '2', name: 'SGR-1 от 27.08.2026' },
      transaction: setup.transaction,
    });
    expect(setup.changeColumn).toHaveBeenCalledWith(
      'permit_documents',
      'name',
      expect.objectContaining({ allowNull: false }),
      { transaction: setup.transaction },
    );
    expect(setup.updateField).toHaveBeenCalledWith(
      expect.objectContaining({ options: expect.objectContaining({ allowNull: false, length: 300 }) }),
      { transaction: setup.transaction },
    );
    expect(setup.updateCollection).toHaveBeenCalledWith({ titleField: 'name' }, { transaction: setup.transaction });
  });

  it('is idempotent when the column exists and creates missing field metadata', async () => {
    const setup = migrationContext({ fieldExists: false });

    await setup.migration.up();

    expect(setup.addColumn).not.toHaveBeenCalled();
    expect(setup.createField).toHaveBeenCalledWith({
      values: expect.objectContaining({
        collectionName: 'permit_documents',
        name: 'name',
        allowNull: false,
        length: 300,
      }),
      transaction: setup.transaction,
    });
  });

  it('fails safely when collection metadata is missing', async () => {
    const setup = migrationContext({ collectionExists: false });

    await expect(setup.migration.up()).rejects.toThrow('collection metadata does not exist');
    expect(setup.updateCollection).not.toHaveBeenCalled();
  });
});
