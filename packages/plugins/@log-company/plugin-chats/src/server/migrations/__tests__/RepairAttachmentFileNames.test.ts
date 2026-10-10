/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import RepairAttachmentFileNames from '../20261005092000-repair-attachment-file-names';

vi.mock('@nocobase/server', () => ({
  Migration: class {
    constructor(private readonly context: { db: unknown }) {}

    get db() {
      return this.context.db;
    }
  },
}));

interface StoredAttachment {
  id: string;
  file_name: string;
  storage_key: string;
}

function migrationDatabase(rows: StoredAttachment[]) {
  const transaction = {};
  const query = vi.fn(async (sql: string, options: { replacements: Record<string, unknown>; transaction: unknown }) => {
    expect(options.transaction).toBe(transaction);
    if (sql.startsWith('select')) {
      return rows
        .filter((row) => BigInt(row.id) > BigInt(String(options.replacements.cursor)))
        .slice(0, Number(options.replacements.limit))
        .map(({ id, file_name }) => ({ id, file_name }));
    }
    const row = rows.find((item) => item.id === options.replacements.id);
    if (row && row.file_name === options.replacements.originalName) {
      row.file_name = String(options.replacements.fileName);
    }
    return [];
  });
  const sequelize = {
    query,
    transaction: vi.fn(async (work: (value: unknown) => Promise<void>) => work(transaction)),
  };
  const migration = new RepairAttachmentFileNames({
    db: { sequelize },
    sequelize,
    queryInterface: {},
  } as unknown as ConstructorParameters<typeof RepairAttachmentFileNames>[0]);
  return { migration, query, sequelize };
}

describe('RepairAttachmentFileNames migration', () => {
  it('repairs stored mojibake without touching valid names or object keys', async () => {
    const name = '2022-11-25 ТВ Л4.pdf';
    const rows = [
      { id: '1', file_name: Buffer.from(name, 'utf8').toString('latin1'), storage_key: 'chats/old-corrupted-key.pdf' },
      { id: '2', file_name: '中文合同.pdf', storage_key: 'chats/chinese.pdf' },
      { id: '3', file_name: 'résumé.pdf', storage_key: 'chats/french.pdf' },
    ];
    const { migration, query } = migrationDatabase(rows);

    await migration.up();
    expect(rows).toEqual([
      { id: '1', file_name: name, storage_key: 'chats/old-corrupted-key.pdf' },
      { id: '2', file_name: '中文合同.pdf', storage_key: 'chats/chinese.pdf' },
      { id: '3', file_name: 'résumé.pdf', storage_key: 'chats/french.pdf' },
    ]);
    expect(query.mock.calls.filter(([sql]) => sql.startsWith('update'))).toHaveLength(1);

    query.mockClear();
    await migration.up();
    expect(query.mock.calls.filter(([sql]) => sql.startsWith('update'))).toHaveLength(0);
  });

  it('uses a stable ID cursor across batches', async () => {
    const rows = Array.from({ length: 501 }, (_, index) => ({
      id: String(index + 1),
      file_name: Buffer.from(`Документ ${index + 1}.pdf`, 'utf8').toString('latin1'),
      storage_key: `chats/${index + 1}.pdf`,
    }));
    const { migration, query } = migrationDatabase(rows);

    await migration.up();

    expect(rows[500].file_name).toBe('Документ 501.pdf');
    const selects = query.mock.calls.filter(([sql]) => sql.startsWith('select'));
    expect(selects).toHaveLength(2);
    expect(selects[1][1].replacements.cursor).toBe('500');
  });

  it('propagates database failures instead of committing a partial repair', async () => {
    const { migration, query, sequelize } = migrationDatabase([]);
    const error = new Error('database unavailable');
    query.mockRejectedValueOnce(error);

    await expect(migration.up()).rejects.toBe(error);
    expect(sequelize.transaction).toHaveBeenCalledOnce();
  });
});
