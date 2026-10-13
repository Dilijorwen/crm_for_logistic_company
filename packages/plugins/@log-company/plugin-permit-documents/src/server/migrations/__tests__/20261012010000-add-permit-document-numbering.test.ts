/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createMockDatabase, type Database } from '@nocobase/database';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SyncPermitDocumentNumberingMetadata from '../20261012020000-sync-permit-document-numbering-metadata';

describe('permit document numbering migration', () => {
  let database: Database;

  afterEach(async () => {
    await database?.close();
  });

  it('backfills chronologically with an ID tie-breaker and preserves assigned numbers on a repeated run', async () => {
    database = await createMockDatabase();
    database.collection({
      name: 'permit_documents',
      autoGenId: false,
      createdAt: true,
      updatedAt: true,
      fields: [{ name: 'id', type: 'bigInt', primaryKey: true }],
    });
    await database.sync({ force: true });
    await database
      .getRepository('permit_documents')
      .create({ values: { id: '20', createdAt: new Date('2026-01-02') } });
    await database
      .getRepository('permit_documents')
      .create({ values: { id: '11', createdAt: new Date('2026-01-01') } });
    await database
      .getRepository('permit_documents')
      .create({ values: { id: '10', createdAt: new Date('2026-01-01') } });
    const metadata = new Map<string, Record<string, unknown>>();
    const fields = {
      findOne: vi.fn(async ({ filter }: { filter: { name: string } }) =>
        metadata.has(filter.name)
          ? { update: async (values: Record<string, unknown>) => metadata.set(filter.name, values) }
          : null,
      ),
      create: vi.fn(async ({ values }: { values: Record<string, unknown> }) =>
        metadata.set(String(values.name), values),
      ),
    };
    const db = { sequelize: database.sequelize, getRepository: () => fields };
    const migration = new SyncPermitDocumentNumberingMetadata({ db } as unknown as ConstructorParameters<
      typeof SyncPermitDocumentNumberingMetadata
    >[0]);
    await migration.up();
    const [rows] = await database.sequelize.query('select id, internal_number from permit_documents order by id');
    expect(rows).toEqual([
      { id: 10, internal_number: 1 },
      { id: 11, internal_number: 2 },
      { id: 20, internal_number: 3 },
    ]);
    await database.sequelize.query('update permit_documents set internal_number = 9 where id = 20');
    await migration.up();
    const [preserved] = await database.sequelize.query('select internal_number from permit_documents where id = 20');
    expect(preserved).toEqual([{ internal_number: 9 }]);
    expect(metadata.size).toBe(3);
    expect(fields.create).toHaveBeenCalledTimes(3);
  });
});
