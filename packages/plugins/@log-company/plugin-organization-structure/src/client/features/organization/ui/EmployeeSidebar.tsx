/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { LeftOutlined, RightOutlined, UserAddOutlined } from '@ant-design/icons';
import { Button, Empty, Flex, Input, Result, Select, Skeleton, Tooltip, Typography, theme } from 'antd';
import React from 'react';
import { useOrganizationTranslation } from '../../../locale';
import type { EmployeeFilter, Identifier, OrganizationEmployee, OrganizationPermissions } from '../model/types';
import { EmployeeListItem } from './EmployeeListItem';

interface EmployeeSidebarProps {
  collapsed: boolean;
  employees: OrganizationEmployee[];
  search: string;
  filter: EmployeeFilter;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  permissions: OrganizationPermissions;
  onCollapsedChange: (collapsed: boolean) => void;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: EmployeeFilter) => void;
  onLoadMore: () => Promise<void>;
  onLocate: (departmentId: Identifier, employeeId: Identifier) => void;
  onAssign: (employee: OrganizationEmployee) => void;
  onOpen: (employee: OrganizationEmployee) => void;
  onTerminate: (employee: OrganizationEmployee) => void;
  onCreate: () => void;
}

export function EmployeeSidebar(props: EmployeeSidebarProps) {
  const { t } = useOrganizationTranslation();
  const { token } = theme.useToken();
  if (props.collapsed) {
    return (
      <aside className="lc-org-panel lc-org-panel--collapsed" aria-label={t('employees.title')}>
        <Tooltip title={t('panels.expandEmployees')} placement="right">
          <Button
            type="text"
            icon={<RightOutlined />}
            aria-label={t('panels.expandEmployees')}
            onClick={() => props.onCollapsedChange(false)}
          />
        </Tooltip>
      </aside>
    );
  }

  return (
    <aside className="lc-org-panel lc-org-panel--left" aria-label={t('employees.title')}>
      <Flex align="center" justify="space-between" className="lc-org-panel__header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t('employees.title')}
        </Typography.Title>
        <Tooltip title={t('panels.collapseEmployees')}>
          <Button
            type="text"
            icon={<LeftOutlined />}
            aria-label={t('panels.collapseEmployees')}
            onClick={() => props.onCollapsedChange(true)}
          />
        </Tooltip>
      </Flex>
      <Flex vertical gap={token.marginXS} style={{ padding: `0 ${token.paddingSM}px ${token.paddingSM}px` }}>
        <Input.Search
          allowClear
          value={props.search}
          placeholder={t('employees.searchPlaceholder')}
          aria-label={t('employees.searchPlaceholder')}
          onChange={(event) => props.onSearchChange(event.target.value)}
        />
        <Select<EmployeeFilter>
          value={props.filter}
          aria-label={t('employees.title')}
          onChange={props.onFilterChange}
          options={[
            { value: 'all', label: t('employees.all') },
            { value: 'unassigned', label: t('employees.unassigned') },
          ]}
        />
      </Flex>
      <div className="lc-org-panel__scroll" aria-live="polite">
        {props.loading && props.employees.length === 0 ? <Skeleton active paragraph={{ rows: 7 }} /> : null}
        {props.error && props.employees.length === 0 ? <Result status="error" title={props.error} /> : null}
        {!props.loading && !props.error && props.employees.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('employees.empty')} />
        ) : null}
        <Flex vertical gap={token.marginXXS}>
          {props.employees.map((employee) => {
            const departmentId = employee.mainDepartmentId || employee.departments[0]?.id;
            return (
              <EmployeeListItem
                key={employee.id}
                employee={employee}
                onSelect={departmentId ? () => props.onLocate(departmentId, employee.id) : undefined}
                onOpen={() => props.onOpen(employee)}
                onAssign={
                  !departmentId && props.permissions.canAssignEmployee(employee.id)
                    ? () => props.onAssign(employee)
                    : undefined
                }
                onMove={
                  departmentId && props.permissions.canMoveEmployee(employee.id)
                    ? () => props.onAssign(employee)
                    : undefined
                }
                onTerminate={
                  props.permissions.canTerminateEmployee(employee.id) ? () => props.onTerminate(employee) : undefined
                }
              />
            );
          })}
        </Flex>
        {props.hasMore ? (
          <Button
            block
            type="text"
            loading={props.loading}
            onClick={async () => props.onLoadMore()}
            style={{ marginTop: token.marginXS }}
          >
            {t('common.loadMore')}
          </Button>
        ) : null}
      </div>
      {props.permissions.canCreateEmployee ? (
        <div className="lc-org-panel__footer">
          <Button block type="primary" icon={<UserAddOutlined />} onClick={props.onCreate}>
            {t('employees.create')}
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
