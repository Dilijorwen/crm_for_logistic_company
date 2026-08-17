/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Descriptions, Empty, Flex, Modal, Tag, Typography, theme } from 'antd';
import React from 'react';
import { useOrganizationTranslation } from '../../../locale';
import type { OrganizationDepartment, OrganizationEmployee, OrganizationPermissions } from '../model/types';
import { EmployeeListItem } from './EmployeeListItem';

interface DepartmentMembersModalProps {
  department: OrganizationDepartment | null;
  permissions: OrganizationPermissions;
  onClose: () => void;
  onOpenEmployee: (employee: OrganizationEmployee) => void;
  onMoveEmployee: (employee: OrganizationEmployee) => void;
  onRemoveEmployee: (employee: OrganizationEmployee) => void;
  onTerminateEmployee: (employee: OrganizationEmployee) => void;
  onMakeManager: (employee: OrganizationEmployee) => void;
}

export function DepartmentMembersModal(props: DepartmentMembersModalProps) {
  const { t } = useOrganizationTranslation();
  const { token } = theme.useToken();
  return (
    <Modal
      open={Boolean(props.department)}
      title={props.department ? `${t('employees.members')}: ${props.department.title}` : t('employees.members')}
      footer={null}
      onCancel={props.onClose}
      destroyOnClose
    >
      <Flex vertical gap={token.marginXXS} style={{ maxHeight: '60vh', overflow: 'auto' }}>
        {props.department?.members.length ? (
          props.department.members.map((employee) => (
            <EmployeeListItem
              key={employee.id}
              employee={employee}
              onOpen={() => props.onOpenEmployee(employee)}
              onMove={props.permissions.canMoveEmployee(employee.id) ? () => props.onMoveEmployee(employee) : undefined}
              onRemove={
                props.permissions.canRemoveEmployee(employee.id) ? () => props.onRemoveEmployee(employee) : undefined
              }
              onTerminate={
                props.permissions.canTerminateEmployee(employee.id)
                  ? () => props.onTerminateEmployee(employee)
                  : undefined
              }
              onMakeManager={
                props.permissions.canAssignManager(props.department?.id)
                  ? () => props.onMakeManager(employee)
                  : undefined
              }
            />
          ))
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('employees.empty')} />
        )}
      </Flex>
    </Modal>
  );
}

interface UserDetailsModalProps {
  employee: OrganizationEmployee | null;
  onClose: () => void;
}

export function UserDetailsModal(props: UserDetailsModalProps) {
  const { t } = useOrganizationTranslation();
  return (
    <Modal
      open={Boolean(props.employee)}
      title={t('employees.details')}
      footer={null}
      onCancel={props.onClose}
      destroyOnClose
    >
      {props.employee ? (
        <Descriptions column={1} size="small">
          <Descriptions.Item label={t('employees.title')}>
            <Typography.Text strong>{props.employee.nickname}</Typography.Text>
          </Descriptions.Item>
          {props.employee.position ? (
            <Descriptions.Item label={t('employees.position')}>{props.employee.position}</Descriptions.Item>
          ) : null}
          <Descriptions.Item label={t('employees.email')}>
            {props.employee.email || t('common.notSpecified')}
          </Descriptions.Item>
          {props.employee.phone ? (
            <Descriptions.Item label={t('employees.phone')}>{props.employee.phone}</Descriptions.Item>
          ) : null}
          <Descriptions.Item label={t('employees.roles')}>
            {props.employee.roles.length > 0
              ? props.employee.roles.map((role) => <Tag key={role.name}>{role.title}</Tag>)
              : t('common.notSpecified')}
          </Descriptions.Item>
          <Descriptions.Item label={t('employees.departments')}>
            {props.employee.departments.length > 0
              ? props.employee.departments.map((department) => <Tag key={department.id}>{department.title}</Tag>)
              : t('common.notSpecified')}
          </Descriptions.Item>
        </Descriptions>
      ) : null}
    </Modal>
  );
}
