/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it, vi } from 'vitest';
import type { ColumnSettings } from '../../../shared/contracts';
import type { AuthorizedTable, PersonalizationRepository, PreferenceOwner, TableConfigurationGateway } from '../ports';
import { TablePersonalizations } from '../TablePersonalizations';
import { PersonalizationError } from '../../domain/PersonalizationError';

const identity = { tableUid: 'table', referencePath: [] };
const settings: ColumnSettings = { version: 1, columnOrder: ['first', 'second'], hiddenColumnUids: ['first'] };
const signature = 'a'.repeat(64);
const table: AuthorizedTable = {
  tableUid: 'table',
  instanceRootUid: 'table',
  instanceKey: 'key',
  schemaSignature: signature,
  existingColumnUids: ['first', 'second'],
  columns: ['first', 'second'].map((uid) => ({ uid, title: uid, fieldPath: uid, fixed: 'normal' })),
};

class MemoryRepository implements PersonalizationRepository {
  readonly rows = new Map<string, ColumnSettings>();
  private key(owner: PreferenceOwner): string {
    return `${owner.userId}:${owner.instanceKey}`;
  }
  async find(owner: PreferenceOwner): Promise<ColumnSettings | null> {
    return this.rows.get(this.key(owner)) || null;
  }
  async save(owner: PreferenceOwner, value: ColumnSettings): Promise<void> {
    this.rows.set(this.key(owner), value);
  }
  async update(
    owner: PreferenceOwner,
    transform: (previous: ColumnSettings | null) => ColumnSettings,
  ): Promise<ColumnSettings> {
    const value = transform(await this.find(owner));
    await this.save(owner, value);
    return value;
  }
  async reset(owner: PreferenceOwner): Promise<void> {
    this.rows.delete(this.key(owner));
  }
}

function fixture(userId = 'user-one', repository = new MemoryRepository()) {
  const configuration: TableConfigurationGateway = { authorize: vi.fn().mockResolvedValue(table) };
  return { configuration, repository, useCase: new TablePersonalizations(configuration, repository, userId) };
}

describe('table personalization use cases', () => {
  it('changes only widths, preserves layout and resets one width independently', async () => {
    const { useCase, repository } = fixture();
    await useCase.execute('save', { identity, settings, schemaSignature: signature });
    const resize = (columnUid: string, width: number | null) =>
      useCase.execute('width', { identity, columnUid, width, schemaSignature: signature });
    await resize('first', 210);
    await resize('second', 310);
    await resize('second', 310);
    expect((await useCase.execute('get', { identity })).settings).toEqual({
      ...settings,
      columnWidths: { first: 210, second: 310 },
    });
    expect(repository.rows.size).toBe(1);
    await useCase.execute('save', {
      identity,
      settings: { ...settings, columnOrder: ['second', 'first'] },
      schemaSignature: signature,
    });
    expect((await resize('first', null)).settings).toEqual({
      ...settings,
      columnOrder: ['second', 'first'],
      columnWidths: { second: 310 },
    });
    expect((await fixture('other-user', repository).useCase.execute('get', { identity })).settings).toBeNull();
    await useCase.execute('reset', { identity });
    expect(repository.rows.size).toBe(0);
  });

  it('supports action column widths without exposing them as selectable fields', async () => {
    const { useCase, configuration } = fixture();
    vi.mocked(configuration.authorize).mockResolvedValue({
      ...table,
      existingColumnUids: ['first', 'second', 'actions'],
      resizableColumnUids: ['first', 'second', 'actions'],
      columns: [
        ...table.columns,
        { uid: 'extra', title: 'Extra', fieldPath: 'extra', fixed: 'normal', source: 'collection' },
      ],
    });
    const result = await useCase.execute('width', {
      identity,
      columnUid: 'actions',
      width: 50,
      schemaSignature: signature,
    });
    expect(result.settings?.hiddenColumnUids).toEqual(['extra']);
    expect(result.settings?.columnWidths).toEqual({ actions: 50 });
    expect(result.columns.map((column) => column.uid)).not.toContain('actions');
  });

  it('validates width, table access, column access and schema before writing', async () => {
    const { useCase, configuration, repository } = fixture();
    const input = { identity, columnUid: 'first', width: 200, schemaSignature: signature };
    await expect(useCase.execute('width', { ...input, width: 5000 })).rejects.toThrow('INVALID_SETTINGS');
    expect(configuration.authorize).not.toHaveBeenCalled();
    await expect(useCase.execute('width', { ...input, columnUid: 'unknown' })).rejects.toThrow('FORBIDDEN');
    await expect(useCase.execute('width', { ...input, schemaSignature: 'b'.repeat(64) })).rejects.toThrow(
      'SCHEMA_CHANGED',
    );
    vi.mocked(configuration.authorize).mockRejectedValueOnce(new PersonalizationError('NOT_FOUND'));
    await expect(useCase.execute('width', input)).rejects.toThrow('NOT_FOUND');
    vi.mocked(configuration.authorize).mockRejectedValueOnce(new PersonalizationError('FORBIDDEN'));
    await expect(useCase.execute('width', input)).rejects.toThrow('FORBIDDEN');
    expect(repository.rows.size).toBe(0);
    vi.spyOn(repository, 'update').mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(useCase.execute('width', input)).rejects.toThrow('storage unavailable');
  });
  it('loads defaults without writing, saves idempotently and resets idempotently', async () => {
    const { useCase, repository } = fixture();
    expect((await useCase.execute('get', { identity })).settings).toBeNull();
    expect(repository.rows.size).toBe(0);
    await useCase.execute('save', { identity, settings, schemaSignature: signature });
    await useCase.execute('save', { identity, settings, schemaSignature: signature });
    expect(repository.rows.size).toBe(1);
    expect((await useCase.execute('get', { identity })).settings).toEqual(settings);
    await useCase.execute('reset', { identity });
    await useCase.execute('reset', { identity });
    expect(repository.rows.size).toBe(0);
  });

  it('isolates users, table copies and template placements', async () => {
    const { useCase, repository } = fixture();
    await useCase.execute('save', { identity, settings, schemaSignature: signature });
    const secondUser = fixture('user-two', repository);
    expect((await secondUser.useCase.execute('get', { identity })).settings).toBeNull();
    for (const instanceKey of ['another-table', 'reference-one', 'reference-two']) {
      const other = fixture('user-one', repository);
      vi.mocked(other.configuration.authorize).mockResolvedValue({ ...table, instanceKey });
      expect((await other.useCase.execute('get', { identity })).settings).toBeNull();
    }
  });

  it('rejects malformed inputs before querying configuration', async () => {
    const { useCase, configuration } = fixture();
    await expect(
      useCase.execute('save', { identity, settings: { version: 99 }, schemaSignature: signature }),
    ).rejects.toThrow('INVALID_SETTINGS');
    expect(configuration.authorize).not.toHaveBeenCalled();
  });

  it.each(['NOT_FOUND', 'FORBIDDEN'] as const)('rejects %s without changing preferences', async (code) => {
    const { useCase, configuration, repository } = fixture();
    vi.mocked(configuration.authorize).mockRejectedValue(new PersonalizationError(code));
    await expect(useCase.execute('save', { identity, settings, schemaSignature: signature })).rejects.toThrow(code);
    expect(repository.rows.size).toBe(0);
  });

  it('rejects a stale schema and unauthorized column injection', async () => {
    const { useCase, repository } = fixture();
    await expect(useCase.execute('save', { identity, settings, schemaSignature: 'b'.repeat(64) })).rejects.toThrow(
      'SCHEMA_CHANGED',
    );
    await expect(
      useCase.execute('save', {
        identity,
        settings: { ...settings, columnOrder: ['injected'], hiddenColumnUids: [] },
        schemaSignature: signature,
      }),
    ).rejects.toThrow('FORBIDDEN');
    expect(repository.rows.size).toBe(0);
  });

  it('propagates storage errors without reporting success', async () => {
    const { useCase, repository } = fixture();
    vi.spyOn(repository, 'save').mockRejectedValue(new Error('storage unavailable'));
    await expect(useCase.execute('save', { identity, settings, schemaSignature: signature })).rejects.toThrow(
      'storage unavailable',
    );
  });
});
