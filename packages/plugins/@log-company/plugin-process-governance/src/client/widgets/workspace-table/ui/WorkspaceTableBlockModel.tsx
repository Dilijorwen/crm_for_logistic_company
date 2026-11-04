/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { BlockModel, TableBlockModel } from '@nocobase/client';
import { observer } from '@formily/react';
import {
  DATA_SOURCE_DIRTY_EVENT,
  FlowModelRenderer,
  MultiRecordResource,
  observable,
  type FlowModel,
} from '@nocobase/flow-engine';
import { theme } from 'antd';
import React from 'react';
import type { WorkspaceRow, WorkspaceTableMeta } from '../../../../shared/workspace';
import { workspaceRecordIds } from '../../../shared/lib';
import { workspaceGroups, synchronizedShipmentSelection } from '../model/workspaceGroups';
import { WorkspaceTableContext } from '../model/WorkspaceTableContext';
import { WorkspaceTableProjection } from './WorkspaceTableProjection';
import { WorkspaceRunSidebar } from './WorkspaceRunSidebar';

const WorkspaceGroupedTable = observer(
  ({ model, table }: { model: LogisticsWorkspaceTableBlockModel; table: TableBlockModel }) => {
    const { token } = theme.useToken();
    const resource = table.context.resource as MultiRecordResource<WorkspaceRow> | undefined;
    const rows = resource?.getData() || [];
    const groups = workspaceGroups(rows, resource?.getMeta('workspace') as WorkspaceTableMeta | undefined);
    const scope = `lc-workspace-bands-${table.uid}`;
    return (
      <WorkspaceTableContext.Provider
        value={{
          table,
          groups,
          selectedRunId: model.workspaceState.selectedRunId,
          collapsedRunIds: model.workspaceState.collapsedRunIds,
          selectRun: (id) => {
            model.workspaceState.selectedRunId = id;
          },
          toggleRun: (id) => {
            const current = model.workspaceState.collapsedRunIds;
            model.workspaceState.collapsedRunIds = current.includes(id)
              ? current.filter((item) => item !== id)
              : [...current, id];
          },
        }}
      >
        <div className={scope}>
          <style>{`
        .${scope} .lc-workspace-layout{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:${token.margin}px;align-items:start;}
        .${scope} .lc-workspace-list{min-width:0;}
        .${scope} .lc-workspace-group-cell{position:relative!important;left:auto!important;right:auto!important;overflow:visible!important;}
        .${scope} .lc-workspace-run-group{width:100%;background:${token.colorFillQuaternary};border-top:${token.marginXS}px solid ${token.colorBgContainer};}
        .${scope} .lc-workspace-run-group.is-selected{background:${token.colorPrimaryBg};box-shadow:inset 3px 0 ${token.colorPrimary};}
        .${scope} .lc-workspace-run-header{display:flex;align-items:center;flex-wrap:wrap;width:100%;box-sizing:border-box;gap:${token.marginXS}px;padding:${token.paddingXS}px;cursor:pointer;}
        .${scope} .lc-workspace-run-title{flex:1 1 0;min-width:0;overflow-wrap:anywhere;}
        .${scope} .lc-workspace-run-title a{font-size:${token.fontSizeLG}px;}
        .${scope} .lc-workspace-run-subtitle{display:flex;gap:${token.marginSM}px;flex-wrap:wrap;font-size:${token.fontSizeSM}px;color:${token.colorTextSecondary};}
        .${scope} .lc-workspace-run-count{white-space:nowrap;}
        .${scope} .lc-workspace-run-controls{display:flex;align-items:center;gap:${token.marginSM}px;margin-left:auto;flex-shrink:0;}
        .${scope} .lc-workspace-transport-icon{font-size:24px;color:${token.colorPrimary};}
        .${scope} .lc-workspace-empty-run{padding:${token.paddingSM}px;color:${token.colorTextSecondary};}
        .${scope} .lc-workspace-sidebar{padding:${token.paddingSM}px;border:1px solid ${token.colorBorderSecondary};border-radius:${token.borderRadiusLG}px;background:${token.colorBgContainer};max-height:calc(100vh - 180px);overflow:auto;position:sticky;top:${token.margin}px;}
        .${scope} .lc-workspace-sidebar-heading{display:flex;justify-content:space-between;align-items:center;}
        .${scope} .lc-workspace-summary-shipment{display:flex;gap:${token.marginXS}px;align-items:center;padding:${token.paddingXS}px 0;border-bottom:1px solid ${token.colorBorderSecondary};}
        .${scope} .lc-workspace-summary-shipment>div{flex:1;min-width:0;}
        .${scope} .lc-workspace-secondary{color:${token.colorTextSecondary};font-size:${token.fontSizeSM}px;}
        .${scope} .ant-collapse-content-box{padding:${token.paddingSM}px!important;}
        @media(max-width:1100px){.${scope} .lc-workspace-layout{grid-template-columns:minmax(0,1fr);}.${scope} .lc-workspace-sidebar{position:static;max-height:none;}}
      `}</style>
          <div className="lc-workspace-layout">
            <div className="lc-workspace-list">
              <FlowModelRenderer model={table as unknown as FlowModel} showFlowSettings={true} />
            </div>
            <WorkspaceRunSidebar />
          </div>
        </div>
      </WorkspaceTableContext.Provider>
    );
  },
);

/** Keeps the original configurable/personalized table and decorates its run groups. */
export class LogisticsWorkspaceTableBlockModel extends BlockModel {
  readonly workspaceState = observable.deep({
    selectedRunId: undefined as string | undefined,
    collapsedRunIds: [] as string[],
  });
  private readonly initialized = new WeakSet<MultiRecordResource>();

  private get nativeTable(): TableBlockModel {
    const table: unknown = this.subModels?.table;
    if (!(table instanceof TableBlockModel)) throw new Error('Native workspace table is not configured');
    return table;
  }

  onInit(options: unknown) {
    super.onInit(options);
    this.context.defineMethod('decorateTableElement', (element: React.ReactElement, table: TableBlockModel) =>
      table.uid === this.nativeTable.uid ? <WorkspaceTableProjection native={element} table={table} /> : element,
    );
    this.context.defineMethod(
      'initializeTableResource',
      (resource: MultiRecordResource<WorkspaceRow>, table: TableBlockModel) => {
        if (table.uid !== this.nativeTable.uid || this.initialized.has(resource)) return;
        this.initialized.add(resource);
        resource.addRequestParameter('workspaceGroupByRun', true);
        const setSelected = resource.setSelectedRows.bind(resource);
        resource.setSelectedRows = (requested: WorkspaceRow[]) =>
          setSelected(synchronizedShipmentSelection(resource.getSelectedRows(), requested, resource.getData()));
        Object.assign(table.rowSelectionProps, {
          preserveSelectedRowKeys: true,
          getCheckboxProps: (row: WorkspaceRow) => ({ disabled: !workspaceRecordIds(row.id)?.shipmentId }),
          onCell: (row: WorkspaceRow) => (!workspaceRecordIds(row.id)?.shipmentId ? { colSpan: 0 } : {}),
        });
      },
    );
    this.context.defineMethod('getWorkspaceShipmentRuns', (shipmentId: string) => {
      const table = this.nativeTable;
      const meta = table.context.resource?.getMeta('workspace') as WorkspaceTableMeta | undefined;
      return meta?.shipmentRuns[shipmentId] || [];
    });
    this.context.defineMethod('selectWorkspaceRun', (id: string) => {
      this.workspaceState.selectedRunId = id;
    });
  }

  renderComponent() {
    return <WorkspaceGroupedTable model={this} table={this.nativeTable} />;
  }

  onMount() {
    super.onMount();
    this.flowEngine.emitter.on(DATA_SOURCE_DIRTY_EVENT, this.refreshTable);
  }

  onUnmount() {
    this.flowEngine.emitter.off(DATA_SOURCE_DIRTY_EVENT, this.refreshTable);
    super.onUnmount();
  }

  private readonly refreshTable = async () => {
    try {
      await this.nativeTable.resource.refresh();
    } catch (error) {
      console.error('Не удалось обновить рабочий список.', error);
    }
  };
}
LogisticsWorkspaceTableBlockModel.define({ label: 'Рейсы и поставки с панелью рейса' });
