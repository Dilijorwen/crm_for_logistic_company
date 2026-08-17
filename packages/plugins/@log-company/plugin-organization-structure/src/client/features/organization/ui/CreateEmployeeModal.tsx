/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Form, Input, Modal } from 'antd';
import React, { useEffect, useState } from 'react';
import { useOrganizationTranslation } from '../../../locale';
import type { CreateEmployeeInput } from '../model/types';

interface CreateEmployeeModalProps {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (input: CreateEmployeeInput) => Promise<void>;
}

interface CreateEmployeeFormValues {
  nickname: string;
  email: string;
  username: string;
}

function isFormValidationError(error: unknown): error is { errorFields: unknown[] } {
  return (
    error !== null &&
    typeof error === 'object' &&
    'errorFields' in error &&
    Array.isArray((error as { errorFields?: unknown }).errorFields)
  );
}

function trimmedValue(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function CreateEmployeeModal(props: CreateEmployeeModalProps) {
  const { t } = useOrganizationTranslation();
  const [form] = Form.useForm<CreateEmployeeFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const isSubmitting = props.loading || submitting;

  useEffect(() => {
    if (!props.open) {
      form.resetFields();
      setSubmitting(false);
    }
  }, [form, props.open]);

  const submit = async (): Promise<void> => {
    if (isSubmitting) {
      return;
    }
    let values: CreateEmployeeFormValues;
    try {
      values = await form.validateFields();
    } catch (error) {
      if (isFormValidationError(error)) {
        return;
      }
      throw error;
    }
    setSubmitting(true);
    try {
      await props.onSubmit({
        nickname: values.nickname.trim(),
        email: values.email.trim(),
        username: values.username.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={props.open}
      title={t('employees.create')}
      okText={t('common.create')}
      cancelText={t('common.cancel')}
      confirmLoading={isSubmitting}
      maskClosable={!isSubmitting}
      keyboard={!isSubmitting}
      onCancel={isSubmitting ? undefined : props.onClose}
      onOk={submit}
    >
      <Form form={form} layout="vertical" requiredMark="optional" disabled={isSubmitting}>
        <Form.Item
          name="nickname"
          label={t('employees.fullName')}
          rules={[
            {
              required: true,
              whitespace: true,
              transform: trimmedValue,
              message: t('validation.fullNameRequired'),
            },
            { max: 255, message: t('validation.fullNameTooLong') },
          ]}
        >
          <Input autoComplete="name" maxLength={255} autoFocus />
        </Form.Item>
        <Form.Item
          name="email"
          label={t('employees.email')}
          rules={[
            {
              required: true,
              whitespace: true,
              transform: trimmedValue,
              message: t('validation.emailRequired'),
            },
            { type: 'email', transform: trimmedValue, message: t('validation.emailInvalid') },
            { max: 255, message: t('validation.emailTooLong') },
          ]}
        >
          <Input autoComplete="email" maxLength={255} />
        </Form.Item>
        <Form.Item
          name="username"
          label={t('employees.login')}
          extra={t('employees.loginHint')}
          rules={[
            {
              required: true,
              whitespace: true,
              transform: trimmedValue,
              message: t('validation.loginRequired'),
            },
            { max: 50, message: t('validation.loginInvalid') },
            {
              pattern: /^[^@<>"'/]+$/,
              transform: trimmedValue,
              message: t('validation.loginInvalid'),
            },
          ]}
        >
          <Input autoComplete="username" maxLength={50} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
