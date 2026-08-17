/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useAuthenticator } from '@nocobase/plugin-auth/client';
import { SchemaComponent, useAPIClient, useNavigateNoUpdate } from '@nocobase/client';
import type { ISchema } from '@formily/react';
import { useForm } from '@formily/react';
import { Button, message, Result, Spin } from 'antd';
import React, { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useOrganizationTranslation } from '../locale';

const resetPasswordForm: ISchema = {
  type: 'object',
  name: 'secureResetPasswordForm',
  'x-component': 'FormV2',
  properties: {
    password: {
      type: 'string',
      'x-component': 'Password',
      title: '{{t("password.new")}}',
      description: '{{t("password.requirements")}}',
      required: true,
      'x-decorator': 'FormItem',
      'x-validator': { password: true },
      'x-component-props': {
        autoComplete: 'new-password',
        checkStrength: true,
        placeholder: '{{t("password.newPlaceholder")}}',
      },
    },
    confirmPassword: {
      type: 'string',
      'x-component': 'Password',
      title: '{{t("password.confirm")}}',
      required: true,
      'x-decorator': 'FormItem',
      'x-component-props': {
        autoComplete: 'new-password',
        placeholder: '{{t("password.confirmPlaceholder")}}',
      },
      'x-validator': `{{(value, rules, {form}) => {
        if (value && value !== form.values.password) {
          return t("validation.passwordMismatch");
        }
      }}}`,
    },
    actions: {
      type: 'void',
      'x-component': 'div',
      properties: {
        submit: {
          title: '{{t("common.confirm")}}',
          type: 'void',
          'x-component': 'Action',
          'x-component-props': {
            htmlType: 'submit',
            block: true,
            type: 'primary',
            useAction: '{{useSecureResetPassword}}',
          },
        },
      },
    },
    signIn: {
      type: 'void',
      'x-component': 'Link',
      'x-component-props': { to: '/signin' },
      'x-content': '{{t("password.goToLogin")}}',
    },
  },
};

export const SECURE_RESET_PASSWORD_COMPONENT = 'LogCompanySecureResetPasswordPage';

export function SecureResetPasswordPage() {
  const { t } = useOrganizationTranslation();
  const api = useAPIClient();
  const navigate = useNavigateNoUpdate();
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get('resetToken');
  const authenticatorName = searchParams.get('name');
  const authenticator = useAuthenticator(authenticatorName);
  const [tokenState, setTokenState] = useState<'checking' | 'valid' | 'expired'>('checking');

  useEffect(() => {
    let active = true;
    if (!resetToken) {
      setTokenState('expired');
      return () => {
        active = false;
      };
    }
    api.auth
      .checkResetToken({ resetToken })
      .then(() => {
        if (active) {
          setTokenState('valid');
        }
      })
      .catch(() => {
        if (active) {
          setTokenState('expired');
        }
      });
    return () => {
      active = false;
    };
  }, [api, resetToken]);

  const useSecureResetPassword = () => {
    const form = useForm();
    const [loading, setLoading] = useState(false);
    return {
      loading,
      async run() {
        await form.submit();
        setLoading(true);
        try {
          await api.auth.resetPassword({ ...form.values, resetToken });
          message.success(t('password.resetSuccess'));
          window.setTimeout(() => {
            window.location.href = '/signin';
          }, 1000);
        } finally {
          setLoading(false);
        }
      },
    };
  };

  if (!authenticator?.options?.enableResetPassword) {
    return <Navigate to="/not-found" replace />;
  }
  if (tokenState === 'checking') {
    return <Spin aria-label={t('common.loading')} />;
  }
  if (tokenState === 'expired') {
    return (
      <Result
        status="403"
        title={t('password.linkExpired')}
        extra={
          <Button type="primary" onClick={() => navigate('/signin')}>
            {t('password.goToLogin')}
          </Button>
        }
      />
    );
  }

  return <SchemaComponent schema={resetPasswordForm} scope={{ t, useSecureResetPassword }} />;
}
