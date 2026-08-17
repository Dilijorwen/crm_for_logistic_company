/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Form, Input, Modal, TreeSelect } from 'antd';
import React, { useEffect, useMemo } from 'react';
import { useOrganizationTranslation } from '../../../locale';
import type { OrganizationStructureService } from '../api/organizationStructureService';
import { buildDepartmentTree } from '../utils/departmentTree';
import type { DepartmentMutationInput, DepartmentTreeNode, Identifier, OrganizationDepartment } from '../model/types';
import { RemoteEmployeeSelect } from './RemoteEmployeeSelect';

interface DepartmentFormValues {
  title: string;
  parentId?: Identifier;
  managerId?: Identifier;
}

interface DepartmentFormModalProps {
  open: boolean;
  loading: boolean;
  service: OrganizationStructureService;
  departments: OrganizationDepartment[];
  department?: OrganizationDepartment;
  initialParentId?: Identifier | null;
  canAssignManager: boolean;
  onClose: () => void;
  onSubmit: (input: DepartmentMutationInput) => Promise<void>;
}

function toTreeSelectData(
  nodes: DepartmentTreeNode[],
): Array<{ value: Identifier; title: string; children: ReturnType<typeof toTreeSelectData> }> {
  return nodes.map((node) => ({ value: node.id, title: node.title, children: toTreeSelectData(node.children) }));
}

export function DepartmentFormModal(props: DepartmentFormModalProps) {
  const { t } = useOrganizationTranslation();
  const [form] = Form.useForm<DepartmentFormValues>();
  const treeData = useMemo(() => toTreeSelectData(buildDepartmentTree(props.departments)), [props.departments]);
  const currentManager = props.department?.owners[0];

  useEffect(() => {
    if (props.open) {
      form.setFieldsValue({
        title: props.department?.title || '',
        parentId: props.department?.parentId || props.initialParentId || undefined,
        managerId: currentManager?.id,
      });
    } else {
      form.resetFields();
    }
  }, [currentManager?.id, form, props.department, props.initialParentId, props.open]);

  const submit = async (): Promise<void> => {
    const values = await form.validateFields();
    await props.onSubmit({
      title: values.title,
      parentId: values.parentId || null,
      managerId: values.managerId || null,
    });
  };

  return (
    <Modal
      open={props.open}
      title={
        props.department
          ? t('departments.edit')
          : props.initialParentId
            ? t('departments.createChild')
            : t('departments.createRoot')
      }
      okText={props.department ? t('common.save') : t('common.create')}
      cancelText={t('common.cancel')}
      confirmLoading={props.loading}
      onCancel={props.onClose}
      onOk={submit}
      destroyOnClose
    >
      <Form form={form} layout="vertical" disabled={props.loading}>
        <Form.Item
          name="title"
          label={t('departments.name')}
          rules={[{ required: true, whitespace: true, message: t('validation.nameRequired') }]}
        >
          <Input maxLength={255} autoFocus aria-label={t('departments.name')} />
        </Form.Item>
        {!props.department ? (
          <Form.Item name="parentId" label={t('departments.parent')}>
            <TreeSelect
              allowClear
              disabled
              treeDefaultExpandAll
              treeData={treeData}
              placeholder={t('departments.root')}
              aria-label={t('departments.parent')}
            />
          </Form.Item>
        ) : null}
        {props.canAssignManager ? (
          <Form.Item name="managerId" label={t('departments.manager')}>
            <RemoteEmployeeSelect
              open={props.open}
              service={props.service}
              currentEmployees={currentManager ? [currentManager] : []}
            />
          </Form.Item>
        ) : null}
      </Form>
    </Modal>
  );
}
