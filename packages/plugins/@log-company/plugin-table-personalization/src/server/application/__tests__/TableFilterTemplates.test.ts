/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TableFilterTemplates } from '../TableFilterTemplates';
import type { StoredFilterTemplate } from '../FilterTemplatePorts';
import { emptyFilter } from '../../../shared/filterTemplates';
import { PersonalizationError } from '../../domain/PersonalizationError';

const identity = { tableUid: 'table', referencePath: [] };
const columnSettings = {
  version: 1 as const,
  columnOrder: ['first', 'second'],
  hiddenColumnUids: ['second'],
  columnWidths: { first: 210 },
};
const signature = 'a'.repeat(64);
const snapshot = { filter: emptyFilter(), columnSettings, schemaSignature: signature };
const template: StoredFilterTemplate = {
  id: 'template',
  userId: '1',
  instanceKey: 'instance',
  instanceRootUid: 'table',
  tableUid: 'table',
  name: 'Мой шаблон',
  filter: emptyFilter(),
  columnSettings,
  revision: 1,
};
const configuration = { authorize: vi.fn(), canUseFilter: vi.fn() };
const repository = { list: vi.fn(), create: vi.fn(), change: vi.fn() };
const useCase = (userId = '1') => new TableFilterTemplates(configuration, repository, userId);

beforeEach(() => {
  vi.resetAllMocks();
  configuration.authorize.mockResolvedValue({
    tableUid: 'table',
    instanceRootUid: 'table',
    instanceKey: 'instance',
    schemaSignature: signature,
    columns: ['first', 'second'].map((uid) => ({ uid, title: uid, fieldPath: uid, fixed: 'normal' })),
    existingColumnUids: ['first', 'second'],
  });
  configuration.canUseFilter.mockResolvedValue(true);
  repository.list.mockResolvedValue([template]);
  repository.create.mockResolvedValue(template);
  repository.change.mockImplementation(
    async (
      _instance: string,
      _user: string,
      _id: string,
      transform: (value: StoredFilterTemplate) => StoredFilterTemplate | null,
    ) => transform(template),
  );
});

describe('personal table templates', () => {
  it('saves the complete snapshot under the authenticated owner and verified instance', async () => {
    const result = await useCase().execute('create', { identity, name: ' Новый ', ...snapshot });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '1',
        instanceKey: 'instance',
        name: 'Новый',
        filter: snapshot.filter,
        columnSettings,
        revision: 1,
      }),
    );
    expect(result).toEqual({
      schemaSignature: signature,
      templates: [{ id: template.id, name: template.name, filter: template.filter, columnSettings, revision: 1 }],
    });
    expect(result).not.toHaveProperty('canCreateShared');
    expect(result.templates[0]).not.toHaveProperty('userId');
  });

  it('loads only the current owner and instance, including for a root account', async () => {
    await useCase('root-user').execute('list', { identity });
    expect(repository.list).toHaveBeenCalledWith('instance', 'root-user');
  });

  it.each(['rename', 'update', 'delete'] as const)('rejects another author for %s', async (operation) => {
    const input = {
      identity,
      id: template.id,
      revision: 1,
      ...(operation === 'rename' ? { name: 'Новое' } : {}),
      ...(operation === 'update' ? snapshot : {}),
    };
    await expect(useCase('root-user').execute(operation, input)).rejects.toThrow('FORBIDDEN');
    expect(repository.change).toHaveBeenCalledWith('instance', 'root-user', template.id, expect.any(Function));
  });

  it('renames without changing either filter or columns', async () => {
    await useCase().execute('rename', { identity, id: template.id, revision: 1, name: 'Новое' });
    const transform = repository.change.mock.calls[0][3] as (value: StoredFilterTemplate) => StoredFilterTemplate;
    expect(transform(template)).toEqual({ ...template, name: 'Новое', revision: 2 });
  });

  it('updates filter, selected/hidden columns, order and exact widths together', async () => {
    const changed = {
      version: 1 as const,
      columnOrder: ['second', 'first'],
      hiddenColumnUids: ['first'],
      columnWidths: { second: 320 },
    };
    const filter = { logic: '$or', items: [{ path: 'first', operator: '$eq', value: 'test' }] };
    await useCase().execute('update', {
      identity,
      id: template.id,
      revision: 1,
      ...snapshot,
      columnSettings: changed,
      filter,
    });
    const transform = repository.change.mock.calls[0][3] as (value: StoredFilterTemplate) => StoredFilterTemplate;
    expect(transform(template)).toEqual({ ...template, columnSettings: changed, filter, revision: 2 });
  });

  it('rejects stale revisions and schema signatures', async () => {
    await expect(
      useCase().execute('rename', { identity, id: template.id, revision: 2, name: 'Новое' }),
    ).rejects.toThrow('CONFLICT');
    await expect(
      useCase().execute('create', { identity, name: 'Новый', ...snapshot, schemaSignature: 'b'.repeat(64) }),
    ).rejects.toThrow('SCHEMA_CHANGED');
  });

  it.each([{ visibility: 'shared' }, { userId: 'victim' }, { scopeKey: 'shared' }])(
    'rejects legacy sharing and forged owner fields: %j',
    async (patch) => {
      await expect(useCase().execute('create', { identity, name: 'Новый', ...snapshot, ...patch })).rejects.toThrow(
        'INVALID_TEMPLATE',
      );
    },
  );

  it.each([
    { columnSettings: { ...columnSettings, columnWidths: { first: 49 } } },
    { columnSettings: { ...columnSettings, columnWidths: { secret: 200 } } },
    { columnSettings: { ...columnSettings, columnOrder: ['secret'], hiddenColumnUids: [] } },
  ])('rejects invalid or unauthorized column settings: %j', async (patch) => {
    await expect(
      useCase().execute('create', { identity, name: 'Новый', ...snapshot, ...patch }),
    ).rejects.toBeInstanceOf(PersonalizationError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('hides filters with unreadable fields and forbids saving them', async () => {
    configuration.canUseFilter.mockResolvedValue(false);
    expect((await useCase().execute('list', { identity })).templates).toEqual([]);
    await expect(useCase().execute('create', { identity, name: 'Новый', ...snapshot })).rejects.toThrow('FORBIDDEN');
  });

  it('does not expose removed or inaccessible column identities', async () => {
    repository.list.mockResolvedValue([
      {
        ...template,
        columnSettings: {
          ...columnSettings,
          columnOrder: ['secret', 'first'],
          hiddenColumnUids: ['secret'],
          columnWidths: { secret: 320 },
        },
      },
    ]);
    const result = await useCase().execute('list', { identity });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('deletes the selected owner template and propagates missing table and storage errors', async () => {
    await useCase().execute('delete', { identity, id: template.id, revision: 1 });
    const transform = repository.change.mock.calls[0][3] as (
      value: StoredFilterTemplate,
    ) => StoredFilterTemplate | null;
    expect(transform(template)).toBeNull();
    configuration.authorize.mockRejectedValueOnce(new PersonalizationError('NOT_FOUND'));
    await expect(useCase().execute('list', { identity })).rejects.toThrow('NOT_FOUND');
    repository.list.mockRejectedValueOnce(new Error('storage offline'));
    await expect(useCase().execute('list', { identity })).rejects.toThrow('storage offline');
  });
});
