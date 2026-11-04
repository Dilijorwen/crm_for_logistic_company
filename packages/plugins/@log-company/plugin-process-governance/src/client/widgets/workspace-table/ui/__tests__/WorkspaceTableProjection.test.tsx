/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { TableBlockModel } from '@nocobase/client';
import { FlowEngine } from '@nocobase/flow-engine';
import { describe, expect, it, vi } from 'vitest';
import type { TableColumnsType } from 'antd';
import type { WorkspaceRow } from '../../../../../shared/workspace';
import { WorkspaceTableContext } from '../../model/WorkspaceTableContext';
import { workspaceGroups } from '../../model/workspaceGroups';
import { WorkspaceTableProjection } from '../WorkspaceTableProjection';

interface ContentProps {
  model: TableBlockModel;
  dataSource: WorkspaceRow[];
  columns: TableColumnsType<WorkspaceRow>;
  pagination?: { showTotal(total: number): string };
}

describe('native table row projection', () => {
  it('merges only group cells, preserves native shipment cells and paginates by runs', () => {
    const table = new FlowEngine().createModel({ use: TableBlockModel });
    const rows = [{ id: '10:100' }, { id: '10:101' }, { id: '11:100' }];
    table.context.defineProperty('resource', { value: { getMeta: () => ({ shipmentCount: 2 }) } });
    const nativeRender = vi.fn(() => 'source value');
    const nativeOnCell = vi.fn(() => ({ title: 'native cell' }));
    let result: ContentProps | undefined;
    function Content(props: ContentProps) {
      result = props;
      return null;
    }
    render(
      <WorkspaceTableContext.Provider
        value={{ table, groups: workspaceGroups(rows), collapsedRunIds: [], selectRun: vi.fn(), toggleRun: vi.fn() }}
      >
        <WorkspaceTableProjection
          table={table}
          native={
            <Content
              model={table}
              dataSource={rows}
              columns={[{ key: 'number', render: nativeRender, onCell: nativeOnCell }, { key: 'status' }]}
            />
          }
        />
      </WorkspaceTableContext.Provider>,
    );
    expect(result?.dataSource.map((row) => row.id)).toEqual(['run:10', '10:100', '10:101', 'run:11', '11:100']);
    const columns = result?.columns;
    expect(columns?.[0].onCell?.(rows[0], 1)).toEqual({ title: 'native cell' });
    expect(columns?.[0].onCell?.({ id: 'run:10', workspaceHeader: true }, 0)).toMatchObject({ colSpan: 3 });
    expect(columns?.[1].onCell?.({ id: 'run:10', workspaceHeader: true }, 0)).toMatchObject({ colSpan: 0 });
    const first = columns?.[0];
    if (first && 'render' in first) expect(first.render?.('100', rows[0], 1)).toBe('source value');
    expect(nativeRender).toHaveBeenCalledWith('100', rows[0], 1);
    expect(result?.pagination?.showTotal(2)).toBe('2 рейсов · 2 уникальных поставок');
  });
});
