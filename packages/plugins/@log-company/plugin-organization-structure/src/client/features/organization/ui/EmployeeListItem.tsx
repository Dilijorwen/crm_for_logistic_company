/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { MoreOutlined } from '@ant-design/icons';
import { Avatar, Button, Dropdown, Flex, Tooltip, Typography, theme, type MenuProps } from 'antd';
import React from 'react';
import { useOrganizationTranslation } from '../../../locale';
import type { OrganizationEmployee } from '../model/types';

interface EmployeeListItemProps {
  employee: OrganizationEmployee;
  highlighted?: boolean;
  compact?: boolean;
  onSelect?: () => void;
  onOpen?: () => void;
  onAssign?: () => void;
  onMove?: () => void;
  onRemove?: () => void;
  onTerminate?: () => void;
  onMakeManager?: () => void;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase())
    .join('');
}

export function EmployeeListItem({
  employee,
  highlighted,
  compact,
  onSelect,
  onOpen,
  onAssign,
  onMove,
  onRemove,
  onTerminate,
  onMakeManager,
}: EmployeeListItemProps) {
  const { t } = useOrganizationTranslation();
  const { token } = theme.useToken();
  const primaryActions: MenuProps['items'] = [
    onOpen ? { key: 'open', label: t('employees.open') } : null,
    onAssign ? { key: 'assign', label: t('employees.assign') } : null,
    onMove ? { key: 'move', label: t('employees.move') } : null,
    onMakeManager ? { key: 'manager', label: t('employees.makeManager') } : null,
    onRemove ? { key: 'remove', danger: true, label: t('employees.remove') } : null,
  ].filter((item) => item !== null);
  const actions: MenuProps['items'] = [
    ...primaryActions,
    onTerminate && primaryActions.length > 0 ? { type: 'divider' as const } : null,
    onTerminate ? { key: 'terminate', danger: true, label: t('employees.terminate') } : null,
  ].filter((item) => item !== null);
  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    const handlers: Record<string, (() => void) | undefined> = {
      assign: onAssign,
      manager: onMakeManager,
      move: onMove,
      open: onOpen,
      remove: onRemove,
      terminate: onTerminate,
    };
    handlers[key]?.();
  };
  const content = (
    <Flex
      align="center"
      gap={token.marginSM}
      style={{ flex: 1, minWidth: 0, cursor: onSelect ? 'pointer' : 'default' }}
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={(event) => {
        if (onSelect && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <span style={{ position: 'relative', flex: '0 0 auto' }}>
        <Avatar size={compact ? 28 : 34} src={employee.avatarUrl}>
          {initials(employee.nickname)}
        </Avatar>
        {employee.isActive !== undefined ? (
          <span
            aria-label={employee.isActive ? t('employees.active') : t('employees.inactive')}
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: employee.isActive ? token.colorSuccess : token.colorTextQuaternary,
              border: `1px solid ${token.colorBgContainer}`,
            }}
          />
        ) : null}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <Tooltip title={employee.nickname} mouseEnterDelay={0.5}>
          <Typography.Text ellipsis style={{ display: 'block', fontSize: compact ? token.fontSizeSM : token.fontSize }}>
            {employee.nickname}
          </Typography.Text>
        </Tooltip>
        {employee.position ? (
          <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: token.fontSizeSM }}>
            {employee.position}
          </Typography.Text>
        ) : null}
      </span>
    </Flex>
  );

  return (
    <Flex
      align="center"
      gap={token.marginXXS}
      data-employee-id={employee.id}
      style={{
        padding: compact ? `${token.paddingXXS}px 0` : `${token.paddingXS}px ${token.paddingXS}px`,
        borderRadius: token.borderRadius,
        background: highlighted ? token.colorPrimaryBg : undefined,
        transition: 'background-color 180ms ease',
      }}
    >
      {content}
      {actions.length > 0 ? (
        <Dropdown menu={{ items: actions, onClick: handleMenuClick }} trigger={['click']}>
          <Button
            type="text"
            size="small"
            icon={<MoreOutlined />}
            aria-label={`${t('common.actions')} ${employee.nickname}`}
            onClick={(event) => event.stopPropagation()}
          />
        </Dropdown>
      ) : null}
    </Flex>
  );
}
