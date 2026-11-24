/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { allowsSectionOperation } from '../DocumentAccessRules';
import { allowsFolderOperation } from '../FolderAccess';

const actor = { isRoot: false, roles: ['declarant'], userId: '12' };

describe('Права раздела документов', () => {
  it('запрещает загрузку для роли во всех компаниях по умолчанию', () => {
    const common = [{ kind: 'role', subject: 'declarant', rights: { write: false } }] as const;
    expect(allowsSectionOperation(common, [], 'write', actor)).toBe(false);
    expect(allowsSectionOperation(common, [], 'read', actor)).toBe(true);
    expect(
      allowsSectionOperation(common, [{ kind: 'user', subject: '12', rights: { write: true } }], 'write', actor),
    ).toBe(true);
  });

  it('проверяет просмотр перед изменением документов и сохраняет доступ администратора', () => {
    const scope = [{ kind: 'role', subject: 'declarant', rights: { read: false } }] as const;
    expect(allowsSectionOperation([], scope, 'write', actor)).toBe(false);
    expect(allowsSectionOperation([], scope, 'delete', { ...actor, isRoot: true })).toBe(true);
  });

  it('учитывает право активных ролей и индивидуальное исключение', () => {
    const common = [{ kind: 'role', subject: 'declarant', rights: { write: false } }] as const;
    const multiRole = { ...actor, roles: ['declarant', 'manager'] };
    expect(allowsSectionOperation(common, [], 'write', multiRole)).toBe(true);
    expect(
      allowsSectionOperation(common, [{ kind: 'user', subject: '12', rights: { write: false } }], 'write', multiRole),
    ).toBe(false);
  });
});

it('allows a role to rename without granting upload rights, and respects an explicit rename denial', () => {
  const actor = { isRoot: false, roles: ['manager'], userId: '23' };
  const shared = [{ kind: 'role' as const, subject: 'manager', rights: { write: false, rename: true } }];
  expect(allowsSectionOperation(shared, [], 'rename', actor)).toBe(true);
  expect(allowsSectionOperation(shared, [], 'write', actor)).toBe(false);
  expect(
    allowsSectionOperation(shared, [{ kind: 'user', subject: '23', rights: { rename: false } }], 'rename', actor),
  ).toBe(false);
  expect(
    allowsSectionOperation(shared, [{ kind: 'user', subject: '23', rights: { read: false } }], 'rename', actor),
  ).toBe(false);
});

it('retains the existing edit capability for a legacy folder writer', () => {
  const actor = { isRoot: false, roles: ['manager'], userId: '23' };
  expect(allowsFolderOperation([{ kind: 'role', subject: 'manager', level: 'write' }], 'rename', actor)).toBe(true);
  expect(allowsFolderOperation([{ kind: 'role', subject: 'manager', level: 'read' }], 'rename', actor)).toBe(false);
});
