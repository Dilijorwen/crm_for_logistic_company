/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import DisableFsaIdThousandsSeparator from '../20260908020000-disable-fsa-id-thousands-separator';

type MigrationContext = ConstructorParameters<typeof DisableFsaIdThousandsSeparator>[0];

function createMigrationContext(existingField: boolean): {
  context: MigrationContext;
  createMetadata: ReturnType<typeof vi.fn>;
  updateMetadata: ReturnType<typeof vi.fn>;
} {
  const createMetadata = vi.fn().mockResolvedValue(undefined);
  const updateMetadata = vi.fn().mockResolvedValue(undefined);
  const fieldsRepository = {
    findOne: vi.fn().mockResolvedValue(existingField ? { update: updateMetadata } : null),
    create: createMetadata,
  };
  const database = {
    getRepository: vi.fn().mockReturnValue(fieldsRepository),
  };
  return {
    context: { db: database } as unknown as MigrationContext,
    createMetadata,
    updateMetadata,
  };
}

describe('DisableFsaIdThousandsSeparator migration', () => {
  it('updates existing FSA identifier metadata', async () => {
    const setup = createMigrationContext(true);

    await new DisableFsaIdThousandsSeparator(setup.context).up();

    expect(setup.updateMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          uiSchema: expect.objectContaining({
            'x-component-props': expect.objectContaining({ separator: '0.00', step: '1' }),
          }),
        }),
      }),
    );
    expect(setup.createMetadata).not.toHaveBeenCalled();
  });

  it('creates missing FSA identifier metadata with the display format', async () => {
    const setup = createMigrationContext(false);

    await new DisableFsaIdThousandsSeparator(setup.context).up();

    expect(setup.createMetadata).toHaveBeenCalledWith({
      values: expect.objectContaining({
        collectionName: 'technical_regulations',
        name: 'fsa_id',
        uiSchema: expect.objectContaining({
          'x-component-props': expect.objectContaining({ separator: '0.00', step: '1' }),
        }),
      }),
    });
    expect(setup.updateMetadata).not.toHaveBeenCalled();
  });
});
