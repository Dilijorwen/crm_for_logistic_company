/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Form, Modal, Select } from 'antd';
import React, { useEffect, useMemo } from 'react';
import { useOrganizationTranslation } from '../../../locale';
import { getDescendantIds } from '../utils/departmentTree';
import type { Identifier, OrganizationDepartment } from '../model/types';

interface MoveDepartmentValues {
  parentId: Identifier | null;
}

interface MoveDepartmentModalProps {
  open: boolean;
  loading: boolean;
  department: OrganizationDepartment | null;
  departments: OrganizationDepartment[];
  onClose: () => void;
  onSubmit: (parentId: Identifier | null) => Promise<void>;
}

export function MoveDepartmentModal(props: MoveDepartmentModalProps) {
  const { t } = useOrganizationTranslation();
  const [form] = Form.useForm<MoveDepartmentValues>();
  const options = useMemo(() => {
    if (!props.department) {
      return [];
    }
    const excluded = getDescendantIds(props.departments, props.department.id);
    excluded.add(props.department.id);
    return props.departments
      .filter((department) => !excluded.has(department.id))
      .map((department) => ({ value: department.id, label: department.title }));
  }, [props.department, props.departments]);

  useEffect(() => {
    if (props.open) {
      form.setFieldsValue({ parentId: props.department?.parentId || null });
    } else {
      form.resetFields();
    }
  }, [form, props.department?.parentId, props.open]);

  const submit = async (): Promise<void> => {
    const values = await form.validateFields();
    await props.onSubmit(values.parentId || null);
  };

  return (
    <Modal
      open={props.open}
      title={t('departments.move')}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={props.loading}
      onCancel={props.onClose}
      onOk={submit}
      destroyOnClose
    >
      <Form form={form} layout="vertical" disabled={props.loading}>
        <Form.Item name="parentId" label={t('departments.parent')}>
          <Select
            allowClear
            options={options}
            placeholder={t('departments.root')}
            aria-label={t('departments.parent')}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
