/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Empty, Flex, Input, Tooltip, Tree, Typography, theme, type TreeProps } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOrganizationTranslation } from '../../../locale';
import { buildDepartmentTree, collectDepartmentIds, filterDepartmentTree } from '../utils/departmentTree';
import type { DepartmentTreeNode, Identifier, OrganizationDepartment } from '../model/types';

interface DepartmentSidebarProps {
  collapsed: boolean;
  departments: OrganizationDepartment[];
  selectedDepartmentId: Identifier | null;
  onCollapsedChange: (collapsed: boolean) => void;
  onLocate: (departmentId: Identifier) => void;
}

function toTreeData(nodes: DepartmentTreeNode[]): NonNullable<TreeProps['treeData']> {
  return nodes.map((node) => ({ key: node.id, title: node.title, children: toTreeData(node.children) }));
}

export function DepartmentSidebar(props: DepartmentSidebarProps) {
  const { t } = useOrganizationTranslation();
  const { token } = theme.useToken();
  const [search, setSearch] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const knownDepartmentIds = useRef(new Set<Identifier>());
  const tree = useMemo(() => buildDepartmentTree(props.departments), [props.departments]);
  const filteredTree = useMemo(() => filterDepartmentTree(tree, search), [search, tree]);
  const treeData = useMemo(() => toTreeData(filteredTree), [filteredTree]);
  const searchExpandedKeys = useMemo(() => collectDepartmentIds(filteredTree), [filteredTree]);
  const effectiveExpandedKeys = search.trim() ? searchExpandedKeys : expandedKeys;

  useEffect(() => {
    const departmentIds = collectDepartmentIds(tree);
    const newDepartmentIds = departmentIds.filter((departmentId) => !knownDepartmentIds.current.has(departmentId));
    knownDepartmentIds.current = new Set(departmentIds);
    if (newDepartmentIds.length > 0) {
      setExpandedKeys((current) => [...new Set([...current, ...newDepartmentIds])]);
    }
  }, [tree]);

  if (props.collapsed) {
    return (
      <aside className="lc-org-panel lc-org-panel--collapsed" aria-label={t('departments.title')}>
        <Tooltip title={t('panels.expandDepartments')} placement="left">
          <Button
            type="text"
            icon={<LeftOutlined />}
            aria-label={t('panels.expandDepartments')}
            onClick={() => props.onCollapsedChange(false)}
          />
        </Tooltip>
      </aside>
    );
  }

  return (
    <aside className="lc-org-panel lc-org-panel--right" aria-label={t('departments.title')}>
      <Flex align="center" justify="space-between" className="lc-org-panel__header">
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t('departments.title')}
        </Typography.Title>
        <Tooltip title={t('panels.collapseDepartments')}>
          <Button
            type="text"
            icon={<RightOutlined />}
            aria-label={t('panels.collapseDepartments')}
            onClick={() => props.onCollapsedChange(true)}
          />
        </Tooltip>
      </Flex>
      <div style={{ padding: `0 ${token.paddingSM}px ${token.paddingSM}px` }}>
        <Input.Search
          allowClear
          value={search}
          placeholder={t('departments.searchPlaceholder')}
          aria-label={t('departments.searchPlaceholder')}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="lc-org-panel__scroll">
        {treeData.length > 0 ? (
          <Tree
            blockNode
            showIcon={false}
            treeData={treeData}
            expandedKeys={effectiveExpandedKeys}
            selectedKeys={props.selectedDepartmentId ? [props.selectedDepartmentId] : []}
            onExpand={setExpandedKeys}
            onSelect={(keys) => {
              const departmentId = keys[0];
              if (departmentId !== undefined) {
                props.onLocate(String(departmentId));
              }
            }}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={search.trim() ? t('departments.emptySearch') : t('departments.empty')}
          />
        )}
      </div>
    </aside>
  );
}
