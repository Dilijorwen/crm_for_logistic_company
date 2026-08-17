/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Context, Next } from '@nocobase/actions';
import { describe, expect, it, vi } from 'vitest';
import { PasswordPolicyPreAction } from '../PasswordPolicyPreAction';

interface TestError extends Error {
  status: number;
}

function createContext(resourceName: string, actionName: string, values: Record<string, unknown>): Context {
  return {
    action: { params: { resourceName, actionName, values } },
    t: vi.fn(() => 'Password policy error'),
    throw(status: number, message: string) {
      const error = new Error(message) as TestError;
      error.status = status;
      throw error;
    },
  } as unknown as Context;
}

describe('PasswordPolicyPreAction', () => {
  const preAction = new PasswordPolicyPreAction();

  it.each([
    ['auth', 'signUp', { password: '1234' }],
    ['auth', 'changePassword', { newPassword: '1234' }],
    ['auth', 'resetPassword', { password: '1234' }],
    ['users', 'create', { password: '1234' }],
    ['users', 'update', { password: '1234' }],
  ])('blocks a weak password for %s:%s', async (resourceName, actionName, values) => {
    const next = vi.fn<Next>();

    await expect(preAction.handle(createContext(resourceName, actionName, values), next)).rejects.toMatchObject({
      status: 422,
      message: 'Password policy error',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a compliant password', async () => {
    const next = vi.fn<Next>();

    await preAction.handle(createContext('auth', 'resetPassword', { password: 'StrongPass1!' }), next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('does not require a password on user updates that do not change it', async () => {
    const next = vi.fn<Next>();

    await preAction.handle(createContext('users', 'update', { nickname: 'New name' }), next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('leaves unrelated actions unchanged', async () => {
    const next = vi.fn<Next>();

    await preAction.handle(createContext('departments', 'create', { title: 'Operations' }), next);

    expect(next).toHaveBeenCalledOnce();
  });
});
