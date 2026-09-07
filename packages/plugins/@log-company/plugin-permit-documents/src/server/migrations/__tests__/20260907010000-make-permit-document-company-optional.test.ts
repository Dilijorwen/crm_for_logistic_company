/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import MakePermitDocumentCompanyOptional from '../20260907010000-make-permit-document-company-optional';

type MigrationContext = ConstructorParameters<typeof MakePermitDocumentCompanyOptional>[0];

function migrationContext(options: { columnExists?: boolean; metadataExists?: boolean } = {}): {
  context: MigrationContext;
  changeColumn: ReturnType<typeof vi.fn>;
  createMetadata: ReturnType<typeof vi.fn>;
  updateMetadata: ReturnType<typeof vi.fn>;
} {
  const changeColumn = vi.fn().mockResolvedValue(undefined);
  const createMetadata = vi.fn().mockResolvedValue(undefined);
  const updateMetadata = vi.fn().mockResolvedValue(undefined);
  const fieldsRepository = {
    findOne: vi.fn().mockResolvedValue(options.metadataExists === false ? null : { update: updateMetadata }),
    create: createMetadata,
  };
  const database = {
    sequelize: {
      getQueryInterface: () => ({
        describeTable: vi
          .fn()
          .mockResolvedValue(options.columnExists === false ? {} : { company_id: { allowNull: false } }),
        changeColumn,
      }),
    },
    getRepository: vi.fn().mockReturnValue(fieldsRepository),
  };
  return {
    context: { db: database } as unknown as MigrationContext,
    changeColumn,
    createMetadata,
    updateMetadata,
  };
}

describe('MakePermitDocumentCompanyOptional migration', () => {
  it('makes company_id nullable and updates the existing association metadata', async () => {
    const setup = migrationContext();

    await new MakePermitDocumentCompanyOptional(setup.context).up();

    expect(setup.changeColumn).toHaveBeenCalledWith(
      'permit_documents',
      'company_id',
      expect.objectContaining({ allowNull: true }),
    );
    expect(setup.updateMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ uiSchema: expect.objectContaining({ required: false }) }),
      }),
    );
  });

  it('creates optional association metadata when it is missing', async () => {
    const setup = migrationContext({ metadataExists: false });

    await new MakePermitDocumentCompanyOptional(setup.context).up();

    expect(setup.createMetadata).toHaveBeenCalledWith({
      values: expect.objectContaining({
        collectionName: 'permit_documents',
        name: 'company',
        uiSchema: expect.objectContaining({ required: false }),
      }),
    });
  });

  it('fails safely when the company_id column is missing', async () => {
    const setup = migrationContext({ columnExists: false });

    await expect(new MakePermitDocumentCompanyOptional(setup.context).up()).rejects.toThrow(
      'The permit_documents.company_id column does not exist.',
    );
    expect(setup.changeColumn).not.toHaveBeenCalled();
    expect(setup.updateMetadata).not.toHaveBeenCalled();
  });
});
