/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Context, Next } from '@nocobase/actions';
import { satisfiesPasswordPolicy } from '../../../shared/passwordPolicy';

const NAMESPACE = '@log-company/plugin-organization-structure';

type PasswordFieldName = 'password' | 'newPassword';

const PASSWORD_ACTION_FIELDS: Readonly<Record<string, PasswordFieldName>> = {
  'auth:signUp': 'password',
  'auth:changePassword': 'newPassword',
  'auth:resetPassword': 'password',
  'users:create': 'password',
  'users:update': 'password',
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export class PasswordPolicyPreAction {
  readonly handle = async (ctx: Context, next: Next): Promise<void> => {
    const { resourceName, actionName } = ctx.action.params;
    const fieldName = PASSWORD_ACTION_FIELDS[`${resourceName}:${actionName}`];
    if (!fieldName) {
      await next();
      return;
    }

    const values = asRecord(ctx.action.params.values);
    if (!Object.prototype.hasOwnProperty.call(values, fieldName)) {
      await next();
      return;
    }
    if (!satisfiesPasswordPolicy(values[fieldName])) {
      ctx.throw(422, ctx.t('validation.passwordPolicy', { ns: NAMESPACE }));
      return;
    }

    await next();
  };
}
