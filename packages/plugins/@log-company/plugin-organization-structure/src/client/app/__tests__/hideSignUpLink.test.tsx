/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to https://www.nocobase.com/agreement.
 */

import type { Authenticator, AuthOptions } from '@nocobase/plugin-auth/client';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { hideSignUpLink } from '../hideSignUpLink';

describe('hideSignUpLink', () => {
  it('passes the registration override only to the password sign-in form', () => {
    const signInForm = vi.fn((_props: { authenticator: Authenticator }) => null);
    const signUpForm = () => null;
    const components: AuthOptions['components'] = { SignInForm: signInForm, SignUpForm: signUpForm };
    const authenticator = {
      name: 'basic',
      authType: 'Email/Password',
      authTypeTitle: 'Password',
      options: { allowSignUp: true, enableResetPassword: true },
    };

    hideSignUpLink(components);
    const SignInForm = components.SignInForm;
    renderToStaticMarkup(<SignInForm authenticator={authenticator} />);

    expect(signInForm.mock.calls[0][0].authenticator).toEqual({
      ...authenticator,
      options: { allowSignUp: false, enableResetPassword: true },
    });
    expect(authenticator.options.allowSignUp).toBe(true);
    expect(components.SignUpForm).toBe(signUpForm);
  });

  it('supports an auth type without a sign-in form', () => {
    const components = {};

    hideSignUpLink(components);

    expect(components).toEqual({});
  });
});
