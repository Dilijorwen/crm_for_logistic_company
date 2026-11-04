/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Button } from 'antd';
import type { TableColumnsType } from 'antd';
import type { TableBlockModel } from '@nocobase/client';
import { observer } from '@nocobase/flow-engine';
import React from 'react';
import type { WorkspaceRow, WorkspaceTableMeta } from '../../../../shared/workspace';
import { workspaceRecordIds } from '../../../shared/lib';
import { openWorkspaceRun } from '../../../features/workspace-actions';
import { groupedTableRows } from '../model/workspaceGroups';
import { useWorkspaceTable } from '../model/WorkspaceTableContext';
import { WorkspaceRunHeader } from './WorkspaceRunHeader';

interface NativeTableContentProps {
  model?: TableBlockModel;
  children?: React.ReactNode;
  columns?: TableColumnsType<WorkspaceRow>;
  dataSource?: WorkspaceRow[];
  pagination?: Record<string, unknown>;
}

export const WorkspaceTableProjection = observer(
  ({ native, table }: { native: React.ReactElement; table: TableBlockModel }) => {
    const state = useWorkspaceTable();
    const meta = table.resource.getMeta('workspace') as WorkspaceTableMeta | undefined;
    function project(node: React.ReactNode): React.ReactNode {
      if (!React.isValidElement<NativeTableContentProps>(node)) return node;
      if (node.props.model !== table || !node.props.columns || !node.props.dataSource) {
        return node.props.children
          ? React.cloneElement(node, undefined, React.Children.map(node.props.children, project))
          : node;
      }
      const columns = node.props.columns;
      const projected = columns.map((column, index) => ({
        ...column,
        onCell: (row: WorkspaceRow, rowIndex?: number) => {
          if (row.workspaceHeader || !workspaceRecordIds(row.id)?.shipmentId) {
            return {
              colSpan: index === 0 ? columns.length + 1 : 0,
              className: 'lc-workspace-group-cell',
              style: { padding: 0 },
            };
          }
          return column.onCell?.(row, rowIndex) || {};
        },
        render: (value: unknown, row: WorkspaceRow, rowIndex: number) => {
          if (row.workspaceHeader) {
            const group = state.groups.find((item) => item.id === row.id.slice(4));
            return index === 0 && group ? <WorkspaceRunHeader group={group} /> : null;
          }
          const ids = workspaceRecordIds(row.id);
          if (!ids?.shipmentId)
            return index === 0 ? (
              <div className="lc-workspace-empty-run">
                Поставок пока нет
                <Button type="link" onClick={() => openWorkspaceRun(table, ids?.runId || '', row.id, 'lcwsshiptab')}>
                  Добавить поставку
                </Button>
              </div>
            ) : null;
          return 'render' in column && column.render ? column.render(value, row, rowIndex) : (value as React.ReactNode);
        },
      }));
      return React.cloneElement(node, {
        columns: projected,
        dataSource: groupedTableRows(state.groups, state.collapsedRunIds),
        pagination: {
          ...node.props.pagination,
          showTotal: (total: number) => `${total} рейсов · ${meta?.shipmentCount ?? 0} уникальных поставок`,
          locale: { items_per_page: 'рейсов / стр.' },
        },
      });
    }
    return <div>{project(native)}</div>;
  },
);
