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
