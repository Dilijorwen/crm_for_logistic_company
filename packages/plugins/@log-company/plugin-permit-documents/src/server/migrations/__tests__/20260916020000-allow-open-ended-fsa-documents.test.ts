/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import AllowOpenEndedFsaDocuments from '../20260916020000-allow-open-ended-fsa-documents';

type MigrationContext = ConstructorParameters<typeof AllowOpenEndedFsaDocuments>[0];

function createMigration(dialect: string) {
  const query = vi.fn().mockResolvedValue(undefined);
  const database = {
    sequelize: {
      getDialect: vi.fn().mockReturnValue(dialect),
      query,
    },
  };
  return {
    migration: new AllowOpenEndedFsaDocuments({ db: database } as unknown as MigrationContext),
    query,
  };
}

describe('AllowOpenEndedFsaDocuments migration', () => {
  it('allows a successful FSA document without an end date in PostgreSQL', async () => {
    const setup = createMigration('postgres');

    await setup.migration.up();

    expect(setup.query).toHaveBeenCalledWith(
      expect.stringContaining("document_type <> 'state_registration_certificate'"),
    );
    expect(setup.query).not.toHaveBeenCalledWith(expect.stringContaining('valid_until is not null'));
  });

  it('does not create a PostgreSQL constraint for other dialects', async () => {
    const setup = createMigration('sqlite');

    await setup.migration.up();

    expect(setup.query).not.toHaveBeenCalled();
  });
});
