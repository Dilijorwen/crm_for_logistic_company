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

import type { AuthOptions } from '@nocobase/plugin-auth/client';
import React from 'react';

export function hideSignUpLink(components?: AuthOptions['components']): void {
  const SignInForm = components?.SignInForm;
  if (!SignInForm) {
    return;
  }

  components.SignInForm = function SignInFormWithoutSignUp({ authenticator }) {
    return (
      <SignInForm authenticator={{ ...authenticator, options: { ...authenticator.options, allowSignUp: false } }} />
    );
  };
}
