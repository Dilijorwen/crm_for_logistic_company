/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Alert, Form, Modal, Select } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { useOrganizationTranslation } from '../../../locale';
import type { Identifier, OrganizationDepartment, OrganizationEmployee } from '../model/types';

interface AssignEmployeeValues {
  departmentId: Identifier;
}

interface AssignEmployeeModalProps {
  open: boolean;
  loading: boolean;
  employee: OrganizationEmployee | null;
  departments: OrganizationDepartment[];
  onClose: () => void;
  onSubmit: (departmentId: Identifier, move: boolean) => Promise<void>;
}

export function AssignEmployeeModal(props: AssignEmployeeModalProps) {
  const { t } = useOrganizationTranslation();
  const [form] = Form.useForm<AssignEmployeeValues>();
  const [targetDepartmentId, setTargetDepartmentId] = useState<Identifier | null>(null);
  const assignedDepartmentIds = useMemo(
    () => new Set(props.employee?.departments.map((department) => department.id) || []),
    [props.employee?.departments],
  );
  const options = useMemo(
    () =>
      props.departments
        .filter((department) => !assignedDepartmentIds.has(department.id))
        .map((department) => ({ value: department.id, label: department.title })),
    [assignedDepartmentIds, props.departments],
  );
  const sourceDepartment = props.employee?.departments[0];
  const targetDepartment = props.departments.find((department) => department.id === targetDepartmentId);
  const move = Boolean(sourceDepartment && targetDepartmentId && !assignedDepartmentIds.has(targetDepartmentId));

  useEffect(() => {
    if (!props.open) {
      form.resetFields();
      setTargetDepartmentId(null);
    }
  }, [form, props.open]);

  const submit = async (): Promise<void> => {
    const values = await form.validateFields();
    await props.onSubmit(values.departmentId, move);
  };

  return (
    <Modal
      open={props.open}
      title={move ? t('employees.move') : t('employees.assign')}
      okText={move ? t('employees.move') : t('employees.assign')}
      cancelText={t('common.cancel')}
      confirmLoading={props.loading}
      onCancel={props.onClose}
      onOk={submit}
      destroyOnClose
    >
      <Form form={form} layout="vertical" disabled={props.loading}>
        <Form.Item
          name="departmentId"
          label={t('departments.title')}
          rules={[{ required: true, message: t('validation.departmentRequired') }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            options={options}
            aria-label={t('departments.title')}
            onChange={setTargetDepartmentId}
          />
        </Form.Item>
      </Form>
      {move && sourceDepartment && targetDepartment ? (
        <Alert
          type="warning"
          showIcon
          message={t('employees.assignmentNotice', {
            source: sourceDepartment.title,
            target: targetDepartment.title,
          })}
        />
      ) : null}
    </Modal>
  );
}
