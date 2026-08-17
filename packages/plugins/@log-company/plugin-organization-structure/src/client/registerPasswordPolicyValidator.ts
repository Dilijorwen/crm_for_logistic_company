/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { registerValidateRules } from '@formily/validator';
import { satisfiesPasswordPolicy } from '../shared/passwordPolicy';

type Translate = (key: string) => string;

export function registerPasswordPolicyValidator(t: Translate): void {
  registerValidateRules({
    password(value: unknown) {
      if (value === undefined || value === null || value === '') {
        return '';
      }
      return satisfiesPasswordPolicy(value) || t('validation.passwordPolicy');
    },
  });
}
