/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { DownOutlined, MoreOutlined, PlusOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Dropdown, Flex, Tooltip, Typography, theme, type MenuProps } from 'antd';
import React, { useMemo } from 'react';
import { useOrganizationTranslation } from '../../../locale';
import { buildDepartmentMemberPreview } from '../utils/departmentMembers';
import type { Identifier, OrganizationDepartment, OrganizationEmployee, OrganizationPermissions } from '../model/types';
import { EmployeeListItem } from './EmployeeListItem';

interface DepartmentCardProps {
  department: OrganizationDepartment;
  permissions: OrganizationPermissions;
  selected: boolean;
  highlightedEmployeeId?: Identifier;
  branchExpanded: boolean;
  hasChildren: boolean;
  setCardRef: (element: HTMLDivElement | null) => void;
  onSelect: () => void;
  onToggleBranch: () => void;
  onCreateChild: () => void;
  onEdit: () => void;
  onMove: () => void;
  onDelete: () => void;
  onAssignManager: () => void;
  onAddEmployees: () => void;
  onShowMembers: () => void;
  onOpenEmployee: (employee: OrganizationEmployee) => void;
  onMoveEmployee: (employee: OrganizationEmployee) => void;
  onRemoveEmployee: (employee: OrganizationEmployee) => void;
  onTerminateEmployee: (employee: OrganizationEmployee) => void;
  onMakeManager: (employee: OrganizationEmployee) => void;
}

export function DepartmentCard(props: DepartmentCardProps) {
  const { t } = useOrganizationTranslation();
  const { token } = theme.useToken();
  const { visibleMembers, hiddenMemberCount } = useMemo(
    () => buildDepartmentMemberPreview(props.department),
    [props.department],
  );
  const canUpdate = props.permissions.canUpdateDepartment(props.department.id);
  const canMove = props.permissions.canMoveDepartment(props.department.id);
  const canDelete = props.permissions.canDeleteDepartment(props.department.id);
  const menuItems: MenuProps['items'] = [
    canUpdate ? { key: 'edit', label: t('departments.edit') } : null,
    props.permissions.canCreateDepartment(props.department.id)
      ? { key: 'child', label: t('departments.createChild') }
      : null,
    props.permissions.canAssignManager(props.department.id)
      ? { key: 'manager', label: t('departments.assignManager') }
      : null,
    props.permissions.canAddMembers(props.department.id) ? { key: 'employees', label: t('employees.add') } : null,
    canMove ? { key: 'move', label: t('departments.move') } : null,
    { key: 'members', label: t('employees.showAll') },
    canDelete ? { type: 'divider' as const } : null,
    canDelete ? { key: 'delete', danger: true, label: t('departments.delete') } : null,
  ].filter((item) => item !== null);
  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    const actions: Record<string, () => void> = {
      child: props.onCreateChild,
      delete: props.onDelete,
      edit: props.onEdit,
      employees: props.onAddEmployees,
      manager: props.onAssignManager,
      members: props.onShowMembers,
      move: props.onMove,
    };
    actions[key]?.();
  };

  return (
    <div className="lc-org-node" data-department-id={props.department.id}>
      <div
        ref={props.setCardRef}
        className={`lc-org-card${props.selected ? ' lc-org-card--selected' : ''}`}
        style={{ borderColor: props.selected ? token.colorPrimary : token.colorBorderSecondary }}
        onClick={props.onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            props.onSelect();
          }
        }}
        data-interactive="true"
      >
        <Flex align="flex-start" justify="space-between" gap={token.marginXS}>
          <Tooltip title={props.department.title} mouseEnterDelay={0.5}>
            <Typography.Title level={5} ellipsis={{ rows: 2 }} style={{ margin: 0, flex: 1 }}>
              {props.department.title}
            </Typography.Title>
          </Tooltip>
          {menuItems.length > 0 ? (
            <Dropdown
              menu={{ items: menuItems, onClick: handleMenuClick }}
              trigger={['click']}
              dropdownRender={(menu) => (
                <div data-interactive="true" onPointerDown={(event) => event.stopPropagation()}>
                  {menu}
                </div>
              )}
            >
              <Button
                type="text"
                size="small"
                icon={<MoreOutlined />}
                aria-label={`${t('common.actions')} ${props.department.title}`}
                onClick={(event) => event.stopPropagation()}
              />
            </Dropdown>
          ) : null}
        </Flex>

        <div className="lc-org-card__section">
          <Typography.Text type="secondary" className="lc-org-card__label">
            {t('departments.manager')}
          </Typography.Text>
          {props.department.owners.length > 0 ? (
            props.department.owners.map((owner) => (
              <EmployeeListItem
                key={owner.id}
                employee={owner}
                compact
                highlighted={props.highlightedEmployeeId === owner.id}
                onOpen={() => props.onOpenEmployee(owner)}
                onMove={props.permissions.canMoveEmployee(owner.id) ? () => props.onMoveEmployee(owner) : undefined}
                onRemove={
                  props.permissions.canRemoveEmployee(owner.id) ? () => props.onRemoveEmployee(owner) : undefined
                }
                onTerminate={
                  props.permissions.canTerminateEmployee(owner.id) ? () => props.onTerminateEmployee(owner) : undefined
                }
              />
            ))
          ) : (
            <Typography.Text type="secondary" italic>
              {t('departments.noManager')}
            </Typography.Text>
          )}
        </div>

        <div className="lc-org-card__section">
          <Typography.Text type="secondary" className="lc-org-card__label">
            {t('departments.members')}
          </Typography.Text>
          {visibleMembers.length > 0 ? (
            visibleMembers.map((member) => (
              <EmployeeListItem
                key={member.id}
                employee={member}
                compact
                highlighted={props.highlightedEmployeeId === member.id}
                onOpen={() => props.onOpenEmployee(member)}
                onMove={props.permissions.canMoveEmployee(member.id) ? () => props.onMoveEmployee(member) : undefined}
                onRemove={
                  props.permissions.canRemoveEmployee(member.id) ? () => props.onRemoveEmployee(member) : undefined
                }
                onTerminate={
                  props.permissions.canTerminateEmployee(member.id)
                    ? () => props.onTerminateEmployee(member)
                    : undefined
                }
                onMakeManager={
                  props.permissions.canAssignManager(props.department.id)
                    ? () => props.onMakeManager(member)
                    : undefined
                }
              />
            ))
          ) : (
            <Typography.Text type="secondary">{t('common.notSpecified')}</Typography.Text>
          )}
          {hiddenMemberCount > 0 ? (
            <Button type="link" size="small" onClick={props.onShowMembers} style={{ paddingInline: 0 }}>
              {t('employees.hiddenCount', { count: hiddenMemberCount })}
            </Button>
          ) : null}
        </div>
      </div>
      {props.hasChildren ? (
        <Tooltip
          title={
            props.branchExpanded
              ? t('departments.collapseBranch', { name: props.department.title })
              : t('departments.expandBranch', { name: props.department.title })
          }
        >
          <Button
            className="lc-org-branch-toggle"
            shape="circle"
            size="small"
            icon={props.branchExpanded ? <UpOutlined /> : <DownOutlined />}
            aria-label={
              props.branchExpanded
                ? t('departments.collapseBranch', { name: props.department.title })
                : t('departments.expandBranch', { name: props.department.title })
            }
            onClick={props.onToggleBranch}
            data-interactive="true"
          />
        </Tooltip>
      ) : null}
      {props.permissions.canCreateDepartment(props.department.id) ? (
        <Tooltip title={t('departments.createChild')}>
          <Button
            className="lc-org-add-child"
            shape="circle"
            size="small"
            icon={<PlusOutlined />}
            aria-label={`${t('departments.createChild')}: ${props.department.title}`}
            onClick={props.onCreateChild}
            data-interactive="true"
          />
        </Tooltip>
      ) : null}
    </div>
  );
}
