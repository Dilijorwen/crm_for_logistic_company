/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Form, Modal } from 'antd';
import React, { useEffect } from 'react';
import { useOrganizationTranslation } from '../../../locale';
import type { OrganizationStructureService } from '../api/organizationStructureService';
import type { Identifier, OrganizationDepartment, OrganizationEmployee } from '../model/types';
import { RemoteEmployeeSelect } from './RemoteEmployeeSelect';

interface EmployeeSelectionValues {
  employeeIds: Identifier[];
}

interface AddEmployeesModalProps {
  open: boolean;
  loading: boolean;
  service: OrganizationStructureService;
  department: OrganizationDepartment | null;
  onClose: () => void;
  onSubmit: (employeeIds: Identifier[]) => Promise<void>;
}

export function AddEmployeesModal(props: AddEmployeesModalProps) {
  const { t } = useOrganizationTranslation();
  const [form] = Form.useForm<EmployeeSelectionValues>();
  useEffect(() => {
    if (!props.open) {
      form.resetFields();
    }
  }, [form, props.open]);
  const submit = async (): Promise<void> => {
    const values = await form.validateFields();
    await props.onSubmit(values.employeeIds);
  };
  return (
    <Modal
      open={props.open}
      title={t('employees.add')}
      okText={t('employees.add')}
      cancelText={t('common.cancel')}
      confirmLoading={props.loading}
      onCancel={props.onClose}
      onOk={submit}
      destroyOnClose
    >
      <Form form={form} layout="vertical" disabled={props.loading}>
        <Form.Item
          name="employeeIds"
          label={t('employees.title')}
          rules={[{ required: true, message: t('validation.employeeRequired') }]}
        >
          <RemoteEmployeeSelect open={props.open} service={props.service} multiple />
        </Form.Item>
      </Form>
    </Modal>
  );
}

interface ManagerModalProps {
  open: boolean;
  loading: boolean;
  service: OrganizationStructureService;
  department: OrganizationDepartment | null;
  onClose: () => void;
  onSubmit: (employeeId: Identifier | null) => Promise<void>;
}

interface ManagerValues {
  employeeId?: Identifier;
}

export function ManagerModal(props: ManagerModalProps) {
  const { t } = useOrganizationTranslation();
  const [form] = Form.useForm<ManagerValues>();
  const manager = props.department?.owners[0];
  useEffect(() => {
    if (props.open) {
      form.setFieldsValue({ employeeId: manager?.id });
    } else {
      form.resetFields();
    }
  }, [form, manager?.id, props.open]);
  const submit = async (): Promise<void> => {
    const values = await form.validateFields();
    await props.onSubmit(values.employeeId || null);
  };
  return (
    <Modal
      open={props.open}
      title={t('departments.assignManager')}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={props.loading}
      onCancel={props.onClose}
      onOk={submit}
      destroyOnClose
    >
      <Form form={form} layout="vertical" disabled={props.loading}>
        <Form.Item name="employeeId" label={t('departments.manager')}>
          <RemoteEmployeeSelect open={props.open} service={props.service} currentEmployees={manager ? [manager] : []} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
