/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createMockDatabase, type Database } from '@nocobase/database';
import { afterEach, describe, expect, it } from 'vitest';
import AddDocumentCategories from '../20261023010000-add-document-categories';

describe('document categories migration', () => {
  let database: Database;
  afterEach(async () => database?.close());
  it('preserves existing numbers and real dates and backfills the default category and searchable period idempotently', async () => {
    database = await createMockDatabase();
    await database.clean({ drop: true });
    database.collection({
      name: 'permit_documents',
      fields: [
        { name: 'internal_number', type: 'bigInt' },
        { name: 'valid_from', type: 'dateOnly' },
        { name: 'valid_until', type: 'dateOnly' },
      ],
    });
    await database.sync();
    await database
      .getRepository('permit_documents')
      .create({ values: { internal_number: 17, valid_from: '2026-01-01', valid_until: '2030-12-31' } });
    const migration = new AddDocumentCategories({ db: database } as unknown as ConstructorParameters<
      typeof AddDocumentCategories
    >[0]);
    await migration.up();
    await migration.up();
    const [rows] = await database.sequelize.query(
      'select category, internal_number, valid_from, valid_until, period_from, period_until from permit_documents',
    );
    expect(rows).toEqual([
      {
        category: 'ordinary',
        internal_number: 17,
        valid_from: '2026-01-01',
        valid_until: '2030-12-31',
        period_from: '2026-01-01',
        period_until: '2030-12-31',
      },
    ]);
  });
});
