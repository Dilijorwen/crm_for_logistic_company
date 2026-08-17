/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { SECURE_RESET_PASSWORD_COMPONENT } from './password/SecureResetPasswordPage';

type PublicAuthRoute = {
  Component?: unknown;
  skipAuthCheck?: boolean;
};

type PublicAuthRouter = {
  get(name: string): PublicAuthRoute | undefined;
};

const PUBLIC_AUTH_ROUTE_NAMES = ['auth.signin', 'auth.signup', 'auth.forgotPassword', 'auth.resetPassword'] as const;

export const configurePublicAuthRoutes = (router: PublicAuthRouter): void => {
  for (const routeName of PUBLIC_AUTH_ROUTE_NAMES) {
    const route = router.get(routeName);
    if (route) {
      route.skipAuthCheck = true;
      if (routeName === 'auth.resetPassword') {
        route.Component = SECURE_RESET_PASSWORD_COMPONENT;
      }
    }
  }
};
