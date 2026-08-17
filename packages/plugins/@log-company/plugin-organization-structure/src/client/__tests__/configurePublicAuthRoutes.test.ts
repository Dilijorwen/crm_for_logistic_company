/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { describe, expect, it } from 'vitest';
import { configurePublicAuthRoutes } from '../configurePublicAuthRoutes';
import { SECURE_RESET_PASSWORD_COMPONENT } from '../password/SecureResetPasswordPage';

type TestRoute = {
  Component?: string;
  skipAuthCheck?: boolean;
};

describe('configurePublicAuthRoutes', () => {
  it('marks authentication pages as public without changing application routes', () => {
    const routes = new Map<string, TestRoute>([
      ['auth.signin', {}],
      ['auth.signup', {}],
      ['auth.forgotPassword', {}],
      ['auth.resetPassword', { skipAuthCheck: false }],
      ['admin.organization-structure', {}],
    ]);

    configurePublicAuthRoutes({ get: (name) => routes.get(name) });

    expect(routes.get('auth.signin')?.skipAuthCheck).toBe(true);
    expect(routes.get('auth.signup')?.skipAuthCheck).toBe(true);
    expect(routes.get('auth.forgotPassword')?.skipAuthCheck).toBe(true);
    expect(routes.get('auth.resetPassword')?.skipAuthCheck).toBe(true);
    expect(routes.get('auth.resetPassword')?.Component).toBe(SECURE_RESET_PASSWORD_COMPONENT);
    expect(routes.get('admin.organization-structure')?.skipAuthCheck).toBeUndefined();
    expect(routes.get('auth.signin')?.Component).toBeUndefined();
  });

  it('supports authentication routes registered after this plugin starts loading', () => {
    const routes = new Map<string, TestRoute>();
    const router = { get: (name: string) => routes.get(name) };

    configurePublicAuthRoutes(router);
    routes.set('auth.signin', {});
    routes.set('auth.signup', {});
    routes.set('auth.forgotPassword', {});
    routes.set('auth.resetPassword', {});
    configurePublicAuthRoutes(router);

    expect(routes.get('auth.signin')?.skipAuthCheck).toBe(true);
    expect(routes.get('auth.signup')?.skipAuthCheck).toBe(true);
    expect(routes.get('auth.forgotPassword')?.skipAuthCheck).toBe(true);
    expect(routes.get('auth.resetPassword')?.skipAuthCheck).toBe(true);
    expect(routes.get('auth.resetPassword')?.Component).toBe(SECURE_RESET_PASSWORD_COMPONENT);
  });
});
