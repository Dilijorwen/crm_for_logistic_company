/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { createMockDatabase, type Database } from '@nocobase/database';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Migration from '../20261104010000-hide-legacy-process-collections';
import { LEGACY_PROCESS_COLLECTIONS } from '../../../shared/legacyProcessCollections';
import processHistory from '../../collections/processHistory';

describe('legacy process collection archival', () => {
  let db: Database;

  beforeEach(async () => {
    db = await createMockDatabase({ dialect: 'sqlite', storage: ':memory:' });
    db.collection({
      name: 'collections',
      fields: [
        { name: 'name', type: 'string' },
        { name: 'title', type: 'string' },
        { name: 'hidden', type: 'boolean' },
      ],
    });
    db.collection({ name: 'process_comments', fields: [{ name: 'text', type: 'text' }] });
    await db.sync();
  });

  afterEach(async () => db.close());

  it('hides legacy metadata idempotently while preserving archived data and current document collections', async () => {
    await db.getRepository('collections').create({
      values: [...LEGACY_PROCESS_COLLECTIONS, 'shipments', 'process_documents', 'process_document_folders'].map(
        (name) => ({ name, title: name, hidden: false }),
      ),
    });
    const comment = await db.getRepository('process_comments').create({ values: { text: 'Архивный комментарий' } });
    const before = comment.toJSON();
    const migration = new Migration({ db });
    await migration.up();
    await migration.up();
    for (const name of LEGACY_PROCESS_COLLECTIONS) {
      expect((await db.getRepository('collections').findOne({ filter: { name } })).get('hidden')).toBe(true);
    }
    for (const name of ['shipments', 'process_documents', 'process_document_folders']) {
      expect((await db.getRepository('collections').findOne({ filter: { name } })).get('hidden')).toBe(false);
    }
    expect((await db.getRepository('process_comments').findOne({ filterByTk: comment.get('id') })).toJSON()).toEqual(
      before,
    );
    expect(processHistory.hidden).toBe(true);
  });

  it('allows upgrading a database without legacy collection metadata', async () => {
    await expect(new Migration({ db }).up()).resolves.toBeUndefined();
    expect(await db.getRepository('collections').count()).toBe(0);
  });
});
