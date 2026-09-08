/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import SyncOptionalCompanyMetadata from '../20260908010000-sync-optional-company-metadata';

type MigrationContext = ConstructorParameters<typeof SyncOptionalCompanyMetadata>[0];

function createMigrationContext(): {
  context: MigrationContext;
  changeColumn: ReturnType<typeof vi.fn>;
  createMetadata: ReturnType<typeof vi.fn>;
  updateCompany: ReturnType<typeof vi.fn>;
  updateCompanyId: ReturnType<typeof vi.fn>;
} {
  const changeColumn = vi.fn().mockResolvedValue(undefined);
  const createMetadata = vi.fn().mockResolvedValue(undefined);
  const updateCompany = vi.fn().mockResolvedValue(undefined);
  const updateCompanyId = vi.fn().mockResolvedValue(undefined);
  const fieldsRepository = {
    findOne: vi.fn().mockImplementation(({ filter }: { filter: { name: string } }) => {
      if (filter.name === 'company_id') {
        return Promise.resolve({ update: updateCompanyId });
      }
      return Promise.resolve({ update: updateCompany });
    }),
    create: createMetadata,
  };
  const database = {
    sequelize: {
      getQueryInterface: () => ({
        describeTable: vi.fn().mockResolvedValue({ company_id: { allowNull: false } }),
        changeColumn,
      }),
    },
    getRepository: vi.fn().mockReturnValue(fieldsRepository),
  };
  return {
    context: { db: database } as unknown as MigrationContext,
    changeColumn,
    createMetadata,
    updateCompany,
    updateCompanyId,
  };
}

describe('SyncOptionalCompanyMetadata migration', () => {
  it('updates the column and both NocoBase field definitions', async () => {
    const setup = createMigrationContext();

    await new SyncOptionalCompanyMetadata(setup.context).up();

    expect(setup.changeColumn).toHaveBeenCalledWith(
      'permit_documents',
      'company_id',
      expect.objectContaining({ allowNull: true }),
    );
    expect(setup.updateCompanyId).toHaveBeenCalledWith(
      expect.objectContaining({ options: expect.objectContaining({ allowNull: true }) }),
    );
    expect(setup.updateCompany).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          allowNull: true,
          uiSchema: expect.objectContaining({ required: false }),
        }),
      }),
    );
    expect(setup.createMetadata).not.toHaveBeenCalled();
  });
});
